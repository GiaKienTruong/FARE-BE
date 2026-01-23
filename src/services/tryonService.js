// src/services/tryonService.js
// Service xử lý logic AI virtual try-on

const axios = require('axios');
const pool = require('../config/database');

// URL của AI service container (self-hosted)
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:7860';

class TryOnService {
    /**
     * Tạo try-on request mới
     * @param {number} userId - ID người dùng
     * @param {string} personImageUrl - URL ảnh người dùng
     * @param {string} garmentImageUrl - URL ảnh quần áo
     * @param {number|null} garmentId - ID quần áo trong wardrobe (optional)
     * @returns {Promise<object>} - Try-on result
     */
    async generateTryOn(userId, personImageUrl, garmentImageUrl, garmentId = null) {
        const startTime = Date.now();

        // 1. Tạo record trong database với status 'processing'
        const insertResult = await pool.query(
            `INSERT INTO tryon_results 
             (user_id, person_image_url, garment_id, garment_image_url, status) 
             VALUES ($1, $2, $3, $4, 'processing') 
             RETURNING id`,
            [userId, personImageUrl, garmentId, garmentImageUrl]
        );

        const tryonId = insertResult.rows[0].id;

        try {
            // 2. Gọi AI service để generate try-on
            const aiResult = await this.callAIService(personImageUrl, garmentImageUrl);

            const processingTime = Date.now() - startTime;

            // 3. Upload result image lên Cloudinary (nếu cần)
            const resultImageUrl = aiResult.output_image;

            // 4. Update database với kết quả
            await pool.query(
                `UPDATE tryon_results 
                 SET status = 'completed', 
                     result_image_url = $1, 
                     processing_time_ms = $2,
                     model_version = $3
                 WHERE id = $4`,
                [resultImageUrl, processingTime, aiResult.model_version || 'catvton-v1', tryonId]
            );

            return {
                id: tryonId,
                status: 'completed',
                resultImageUrl,
                processingTimeMs: processingTime
            };

        } catch (error) {
            // Xử lý lỗi
            await pool.query(
                `UPDATE tryon_results 
                 SET status = 'failed', error_message = $1 
                 WHERE id = $2`,
                [error.message, tryonId]
            );

            throw error;
        }
    }

    /**
     * Gọi AI service (CatVTON hoặc IDM-VTON)
     * @param {string} personImageUrl - URL ảnh người
     * @param {string} garmentImageUrl - URL ảnh quần áo
     * @returns {Promise<object>} - AI service response
     */
    async callAIService(personImageUrl, garmentImageUrl) {
        try {
            const response = await axios.post(`${AI_SERVICE_URL}/api/tryon`, {
                person_image: personImageUrl,
                garment_image: garmentImageUrl,
                category: 'full-body',  // User yêu cầu full-body
                denoise_steps: 30,
                seed: -1  // Random seed
            }, {
                timeout: 60000,  // 60 seconds timeout cho real-time
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                throw new Error('AI Service không khả dụng. Vui lòng kiểm tra container đang chạy.');
            }
            if (error.response) {
                throw new Error(`AI Service error: ${error.response.data.error || error.response.statusText}`);
            }
            throw error;
        }
    }

    /**
     * Lấy kết quả try-on theo ID
     * @param {number} tryonId - ID của try-on
     * @param {number} userId - ID người dùng (để verify ownership)
     * @returns {Promise<object|null>}
     */
    async getResult(tryonId, userId) {
        const result = await pool.query(
            `SELECT id, person_image_url, garment_id, garment_image_url, 
                    result_image_url, status, error_message, processing_time_ms,
                    model_version, created_at
             FROM tryon_results 
             WHERE id = $1 AND user_id = $2`,
            [tryonId, userId]
        );

        return result.rows[0] || null;
    }

    /**
     * Lấy lịch sử try-on của user
     * @param {number} userId - ID người dùng
     * @param {number} limit - Số lượng kết quả
     * @param {number} offset - Offset cho pagination
     * @returns {Promise<object[]>}
     */
    async getHistory(userId, limit = 20, offset = 0) {
        const result = await pool.query(
            `SELECT id, person_image_url, garment_id, garment_image_url, 
                    result_image_url, status, processing_time_ms, created_at
             FROM tryon_results 
             WHERE user_id = $1 AND status = 'completed'
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        return result.rows;
    }

    /**
     * Xóa try-on result
     * @param {number} tryonId - ID của try-on
     * @param {number} userId - ID người dùng
     * @returns {Promise<boolean>}
     */
    async deleteResult(tryonId, userId) {
        const result = await pool.query(
            `DELETE FROM tryon_results WHERE id = $1 AND user_id = $2 RETURNING id`,
            [tryonId, userId]
        );

        return result.rowCount > 0;
    }

    /**
     * Kiểm tra trạng thái AI service
     * @returns {Promise<object>}
     */
    async checkAIServiceHealth() {
        try {
            const response = await axios.get(`${AI_SERVICE_URL}/health`, {
                timeout: 5000
            });
            return {
                status: 'online',
                ...response.data
            };
        } catch (error) {
            return {
                status: 'offline',
                error: error.message
            };
        }
    }
}

module.exports = new TryOnService();
