// src/routes/tryon.js
// API endpoints cho virtual try-on feature

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const tryonService = require('../services/tryonService');
const cloudinary = require('../config/cloudinary');

// Configure multer for image upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ chấp nhận file ảnh'), false);
        }
    }
});

/**
 * @swagger
 * /api/tryon/generate:
 *   post:
 *     summary: Generate virtual try-on image
 *     tags: [Try-On]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               person_image:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh người dùng
 *               garment_image:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh quần áo (nếu không dùng garment_id)
 *               garment_id:
 *                 type: integer
 *                 description: ID của quần áo trong wardrobe
 *               person_image_url:
 *                 type: string
 *                 description: URL ảnh người dùng (thay cho upload)
 *     responses:
 *       200:
 *         description: Try-on result
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: AI service error
 */
router.post('/generate',
    authenticateToken,
    upload.fields([
        { name: 'person_image', maxCount: 1 },
        { name: 'garment_image', maxCount: 1 }
    ]),
    async (req, res, next) => {
        try {
            let personImageUrl = req.body.person_image_url;
            let garmentImageUrl = req.body.garment_image_url;
            const garmentId = req.body.garment_id ? parseInt(req.body.garment_id) : null;

            // Upload person image nếu có file
            if (req.files?.person_image?.[0]) {
                const personUpload = await uploadToCloudinary(
                    req.files.person_image[0].buffer,
                    'fare/tryon/persons'
                );
                personImageUrl = personUpload.secure_url;
            }

            // Upload garment image nếu có file
            if (req.files?.garment_image?.[0]) {
                const garmentUpload = await uploadToCloudinary(
                    req.files.garment_image[0].buffer,
                    'fare/tryon/garments'
                );
                garmentImageUrl = garmentUpload.secure_url;
            }

            // Nếu có garment_id, lấy URL từ database
            if (garmentId && !garmentImageUrl) {
                const pool = require('../config/database');
                const garmentResult = await pool.query(
                    'SELECT processed_image_url, original_image_url FROM clothing_items WHERE id = $1 AND user_id = $2',
                    [garmentId, req.user.id]
                );

                if (garmentResult.rows.length === 0) {
                    return res.status(404).json({
                        error: { message: 'Không tìm thấy quần áo với ID này' }
                    });
                }

                garmentImageUrl = garmentResult.rows[0].processed_image_url ||
                    garmentResult.rows[0].original_image_url;
            }

            // Validate required inputs
            if (!personImageUrl) {
                return res.status(400).json({
                    error: { message: 'Cần cung cấp ảnh người dùng (person_image hoặc person_image_url)' }
                });
            }

            if (!garmentImageUrl) {
                return res.status(400).json({
                    error: { message: 'Cần cung cấp ảnh quần áo (garment_image, garment_image_url, hoặc garment_id)' }
                });
            }

            // Generate try-on
            const result = await tryonService.generateTryOn(
                req.user.id,
                personImageUrl,
                garmentImageUrl,
                garmentId
            );

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('Try-on generate error:', error);
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/tryon/result/{id}:
 *   get:
 *     summary: Get try-on result by ID
 *     tags: [Try-On]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Try-on result details
 *       404:
 *         description: Result not found
 */
router.get('/result/:id', authenticateToken, async (req, res, next) => {
    try {
        const tryonId = parseInt(req.params.id);
        const result = await tryonService.getResult(tryonId, req.user.id);

        if (!result) {
            return res.status(404).json({
                error: { message: 'Không tìm thấy kết quả try-on' }
            });
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/tryon/history:
 *   get:
 *     summary: Get user's try-on history
 *     tags: [Try-On]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of try-on results
 */
router.get('/history', authenticateToken, async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = parseInt(req.query.offset) || 0;

        const results = await tryonService.getHistory(req.user.id, limit, offset);

        res.json({
            success: true,
            data: results,
            pagination: {
                limit,
                offset,
                count: results.length
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/tryon/result/{id}:
 *   delete:
 *     summary: Delete a try-on result
 *     tags: [Try-On]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Successfully deleted
 *       404:
 *         description: Result not found
 */
router.delete('/result/:id', authenticateToken, async (req, res, next) => {
    try {
        const tryonId = parseInt(req.params.id);
        const deleted = await tryonService.deleteResult(tryonId, req.user.id);

        if (!deleted) {
            return res.status(404).json({
                error: { message: 'Không tìm thấy kết quả try-on hoặc không có quyền xóa' }
            });
        }

        res.json({
            success: true,
            message: 'Đã xóa kết quả try-on'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/tryon/health:
 *   get:
 *     summary: Check AI service health status
 *     tags: [Try-On]
 *     responses:
 *       200:
 *         description: AI service status
 */
router.get('/health', async (req, res, next) => {
    try {
        const health = await tryonService.checkAIServiceHealth();
        res.json({
            success: true,
            data: health
        });
    } catch (error) {
        next(error);
    }
});

// Helper function to upload buffer to Cloudinary
async function uploadToCloudinary(buffer, folder) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: 'image',
                transformation: [
                    { width: 1024, height: 1024, crop: 'limit' }
                ]
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );

        const Readable = require('stream').Readable;
        const readableStream = new Readable();
        readableStream.push(buffer);
        readableStream.push(null);
        readableStream.pipe(uploadStream);
    });
}

module.exports = router;
