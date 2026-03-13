// src/services/tryonService.js
// Virtual Try-On powered by Fal.ai (production)

const axios = require('axios');
const pool = require('../config/database');

const FAL_KEY = process.env.FAL_KEY;

// Fal.ai endpoint for virtual try-on (IDM-VTON model)
const FAL_TRYON_URL = 'https://fal.run/fal-ai/idm-vton';

class TryOnService {
    /**
     * Gọi Fal.ai API để generate try-on image
     */
    async callFalAI(personImageUrl, garmentImageUrl) {
        if (!FAL_KEY) {
            throw new Error('FAL_KEY is not configured. Please set the FAL_KEY environment variable.');
        }

        console.log('🚀 [Fal.ai] Starting virtual try-on...');
        console.log('  Person:', personImageUrl);
        console.log('  Garment:', garmentImageUrl);

        const response = await axios.post(FAL_TRYON_URL, {
            human_image_url: personImageUrl,
            garment_image_url: garmentImageUrl,
            description: 'A stylish outfit',
            is_checked: true,
            is_checked_crop: false,
            denoise_steps: 30,
            seed: 42,
        }, {
            headers: {
                'Authorization': `Key ${FAL_KEY}`,
                'Content-Type': 'application/json',
            },
            timeout: 120000, // 2 min timeout
        });

        const resultImageUrl = response.data?.image?.url || response.data?.images?.[0]?.url;
        if (!resultImageUrl) {
            throw new Error('Fal.ai did not return an image URL');
        }

        console.log('✅ [Fal.ai] Try-on completed:', resultImageUrl);
        return {
            output_image: resultImageUrl,
            model_version: 'fal-idm-vton',
        };
    }

    /**
     * Upload image buffer to Cloudinary
     */
    async uploadToCloudinary(buffer, folder = 'fare/tryon/results') {
        const cloudinary = require('../config/cloudinary');
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder, resource_type: 'image' },
                (error, result) => { if (error) reject(error); else resolve(result); }
            );
            const { Readable } = require('stream');
            const readable = new Readable();
            readable.push(buffer);
            readable.push(null);
            readable.pipe(uploadStream);
        });
    }

    /**
     * Main: generate virtual try-on
     */
    async generateTryOn(userId, personImageUrl, garmentImageUrl, garmentId = null) {
        const startTime = Date.now();

        // 1. Create record in DB with status 'processing'
        const insertResult = await pool.query(
            `INSERT INTO tryon_results 
             (user_id, person_image_url, garment_id, garment_image_url, status) 
             VALUES ($1, $2, $3, $4, 'processing') 
             RETURNING id`,
            [userId, personImageUrl, garmentId, garmentImageUrl]
        );
        const tryonId = insertResult.rows[0].id;

        // 2. Run AI in background (non-blocking) so client can start polling
        (async () => {
            try {
                console.log(`[ASYNC] Processing try-on ID: ${tryonId}`);

                // Call Fal.ai
                const aiResult = await this.callFalAI(personImageUrl, garmentImageUrl);
                const processingTime = Date.now() - startTime;

                // Download result image and re-upload to Cloudinary for permanence
                let finalImageUrl = aiResult.output_image;
                try {
                    const imgResponse = await axios.get(aiResult.output_image, {
                        responseType: 'arraybuffer',
                        timeout: 60000,
                    });
                    const uploadResult = await this.uploadToCloudinary(Buffer.from(imgResponse.data));
                    finalImageUrl = uploadResult.secure_url;
                    console.log('✅ Saved to Cloudinary:', finalImageUrl);
                } catch (uploadErr) {
                    console.warn('⚠️ Cloudinary upload failed, using Fal.ai URL directly:', uploadErr.message);
                }

                // Update DB with result
                await pool.query(
                    `UPDATE tryon_results 
                     SET status = 'completed', result_image_url = $1, 
                         processing_time_ms = $2, model_version = $3
                     WHERE id = $4`,
                    [finalImageUrl, processingTime, aiResult.model_version, tryonId]
                );
                console.log(`[ASYNC] Done! Try-on ${tryonId} completed in ${(processingTime / 1000).toFixed(1)}s`);

            } catch (error) {
                console.error(`[ASYNC ERROR] Try-on ${tryonId} failed:`, error.message);
                await pool.query(
                    `UPDATE tryon_results SET status = 'failed', error_message = $1 WHERE id = $2`,
                    [error.message, tryonId]
                );
            }
        })();

        // 3. Return immediately so app starts polling
        return {
            id: tryonId,
            status: 'processing',
            message: 'AI đang xử lý. Thường mất khoảng 10-20 giây.',
        };
    }

    /**
     * Get a single try-on result
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
     * Get try-on history for a user
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
     * Delete a try-on result
     */
    async deleteResult(tryonId, userId) {
        const result = await pool.query(
            `DELETE FROM tryon_results WHERE id = $1 AND user_id = $2 RETURNING id`,
            [tryonId, userId]
        );
        return result.rowCount > 0;
    }

    /**
     * Health check
     */
    async checkAIServiceHealth() {
        return {
            status: 'online',
            provider: 'fal.ai',
            model: 'idm-vton',
            note: 'FAL.ai-powered. No local model required.',
            fal_key_configured: !!FAL_KEY,
        };
    }
}

module.exports = new TryOnService();
