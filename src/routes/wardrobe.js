// routes/wardrobe.js - Wardrobe Management Routes
const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../config/database');
const { verifyToken } = require('./auth');
const cloudinary = require('../config/cloudinary');

// Configure multer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

// Helper: Upload to Cloudinary
async function uploadToCloudinary(buffer, folder = 'wardrobe') {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: `fare/${folder}` },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        const Readable = require('stream').Readable;
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);
        stream.pipe(uploadStream);
    });
}

// Helper: Get user ID
async function getUserId(firebaseUid) {
    const result = await pool.query(
        'SELECT id FROM users WHERE firebase_uid = $1',
        [firebaseUid]
    );
    return result.rows[0]?.id;
}

// POST /api/wardrobe/items - Upload new clothing item
router.post('/items', verifyToken, upload.single('image'), async (req, res) => {
    const client = await pool.connect();

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image provided' });
        }

        const userId = await getUserId(req.user.uid);
        if (!userId) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { name, category, subcategory, brand, color, size } = req.body;

        const uploadResult = await uploadToCloudinary(req.file.buffer);

        const result = await client.query(
            `INSERT INTO clothing_items (
        user_id, name, category, subcategory, 
        brand, color, size, original_image_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
            [userId, name, category, subcategory, brand, color, size, uploadResult.secure_url]
        );

        await client.query(
            'INSERT INTO activity_log (user_id, action_type, item_id) VALUES ($1, $2, $3)',
            [userId, 'upload_item', result.rows[0].id]
        );

        res.status(201).json({
            message: 'Item added successfully',
            item: result.rows[0]
        });

    } catch (error) {
        console.error('Item upload error:', error);
        res.status(500).json({ error: 'Failed to upload item' });
    } finally {
        client.release();
    }
});

// GET /api/wardrobe/items - Get all clothing items
router.get('/items', verifyToken, async (req, res) => {
    const client = await pool.connect();

    try {
        const userId = await getUserId(req.user.uid);
        const { category, favorite } = req.query;

        let query = 'SELECT * FROM clothing_items WHERE user_id = $1';
        const params = [userId];

        if (category) {
            query += ' AND category = $2';
            params.push(category);
        }

        if (favorite === 'true') {
            query += ' AND favorite = true';
        }

        query += ' ORDER BY created_at DESC';

        const result = await client.query(query, params);

        res.json({
            items: result.rows,
            total: result.rows.length
        });

    } catch (error) {
        console.error('Fetch items error:', error);
        res.status(500).json({ error: 'Failed to fetch items' });
    } finally {
        client.release();
    }
});

// GET /api/wardrobe/items/:id - Get single item
router.get('/items/:id', verifyToken, async (req, res) => {
    const client = await pool.connect();

    try {
        const userId = await getUserId(req.user.uid);
        const itemId = req.params.id;

        const result = await client.query(
            'SELECT * FROM clothing_items WHERE id = $1 AND user_id = $2',
            [itemId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json({ item: result.rows[0] });

    } catch (error) {
        console.error('Fetch item error:', error);
        res.status(500).json({ error: 'Failed to fetch item' });
    } finally {
        client.release();
    }
});

// PUT /api/wardrobe/items/:id - Update item
router.put('/items/:id', verifyToken, async (req, res) => {
    const client = await pool.connect();

    try {
        const userId = await getUserId(req.user.uid);
        const itemId = req.params.id;
        const { name, category, brand, color, size, favorite } = req.body;

        const result = await client.query(
            `UPDATE clothing_items SET
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        brand = COALESCE($3, brand),
        color = COALESCE($4, color),
        size = COALESCE($5, size),
        favorite = COALESCE($6, favorite),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND user_id = $8
      RETURNING *`,
            [name, category, brand, color, size, favorite, itemId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json({
            message: 'Item updated successfully',
            item: result.rows[0]
        });

    } catch (error) {
        console.error('Update item error:', error);
        res.status(500).json({ error: 'Failed to update item' });
    } finally {
        client.release();
    }
});

// DELETE /api/wardrobe/items/:id - Delete item
router.delete('/items/:id', verifyToken, async (req, res) => {
    const client = await pool.connect();

    try {
        const userId = await getUserId(req.user.uid);
        const itemId = req.params.id;

        const result = await client.query(
            'DELETE FROM clothing_items WHERE id = $1 AND user_id = $2 RETURNING id',
            [itemId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json({ message: 'Item deleted successfully' });

    } catch (error) {
        console.error('Delete item error:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    } finally {
        client.release();
    }
});

// GET /api/wardrobe/stats - Get wardrobe statistics
router.get('/stats', verifyToken, async (req, res) => {
    const client = await pool.connect();

    try {
        const userId = await getUserId(req.user.uid);

        const result = await client.query(
            `SELECT 
        COUNT(*) as total_items,
        COUNT(*) FILTER (WHERE category = 'top') as tops,
        COUNT(*) FILTER (WHERE category = 'bottom') as bottoms,
        COUNT(*) FILTER (WHERE category = 'dress') as dresses,
        COUNT(*) FILTER (WHERE category = 'outerwear') as outerwear,
        COUNT(*) FILTER (WHERE category = 'shoes') as shoes,
        COUNT(*) FILTER (WHERE category = 'accessory') as accessories,
        COUNT(*) FILTER (WHERE favorite = true) as favorites
      FROM clothing_items 
      WHERE user_id = $1`,
            [userId]
        );

        res.json({ stats: result.rows[0] });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    } finally {
        client.release();
    }
});

module.exports = router;