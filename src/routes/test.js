const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/test/users - Get all users (no auth)
router.get('/users', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, email, display_name, height, weight, gender, created_at FROM users'
        );
        res.json({
            success: true,
            users: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/test/wardrobe/:userId - Get user's wardrobe (no auth)
router.get('/wardrobe/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const result = await pool.query(
            'SELECT * FROM clothing_items WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        res.json({
            success: true,
            items: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/test/create-sample-data - Tạo dữ liệu mẫu
router.post('/create-sample-data', async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Tạo user nếu chưa có
        const userResult = await client.query(
            `INSERT INTO users (firebase_uid, email, display_name, height, weight, gender)
       VALUES ('test-uid-123', 'test@fare.com', 'Test User', 175, 70, 'male')
       ON CONFLICT (firebase_uid) DO NOTHING
       RETURNING id`
        );

        let userId;
        if (userResult.rows.length > 0) {
            userId = userResult.rows[0].id;
        } else {
            const existingUser = await client.query(
                'SELECT id FROM users WHERE firebase_uid = $1',
                ['test-uid-123']
            );
            userId = existingUser.rows[0].id;
        }

        // Tạo sample clothing items
        const items = [
            { name: 'Blue Denim Jacket', category: 'outerwear', brand: 'Levi\'s', color: 'blue', size: 'M' },
            { name: 'White T-Shirt', category: 'top', brand: 'Uniqlo', color: 'white', size: 'M' },
            { name: 'Black Jeans', category: 'bottom', brand: 'Zara', color: 'black', size: 'M' },
            { name: 'Red Hoodie', category: 'top', brand: 'H&M', color: 'red', size: 'L' },
            { name: 'Khaki Chinos', category: 'bottom', brand: 'Gap', color: 'beige', size: 'M' }
        ];

        const insertedItems = [];
        for (const item of items) {
            const result = await client.query(
                `INSERT INTO clothing_items (user_id, name, category, brand, color, size, original_image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
                [
                    userId,
                    item.name,
                    item.category,
                    item.brand,
                    item.color,
                    item.size,
                    'https://via.placeholder.com/500' // Placeholder image
                ]
            );
            insertedItems.push(result.rows[0]);
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Sample data created',
            userId: userId,
            items: insertedItems
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// DELETE /api/test/cleanup - Xóa test data
router.delete('/cleanup', async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Xóa test user và cascade delete
        await client.query(
            `DELETE FROM users WHERE firebase_uid = 'test-uid-123'`
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Test data cleaned up'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

module.exports = router;