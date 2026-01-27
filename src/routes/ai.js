// routes/ai.js - AI Features Routes
const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../config/database');
const { verifyToken } = require('./auth');

// Helper: Get user ID
async function getUserId(firebaseUid) {
    const result = await pool.query(
        'SELECT id FROM users WHERE firebase_uid = $1',
        [firebaseUid]
    );
    return result.rows[0]?.id;
}

/**
 * @swagger
 * /api/ai/style-check:
 *   post:
 *     summary: AI Style Check
 *     description: Find matching items in wardrobe for a selected clothing item
 *     tags: [AI Features]
 *     security:
 *       - BearerAuth: []
 */
router.post('/style-check', verifyToken, async (req, res) => {
    const client = await pool.connect();

    try {
        const userId = await getUserId(req.user.uid);
        const { itemId } = req.body;

        // Get the item
        const itemResult = await client.query(
            'SELECT * FROM clothing_items WHERE id = $1 AND user_id = $2',
            [itemId, userId]
        );

        if (itemResult.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const item = itemResult.rows[0];

        // Get all other items in wardrobe
        const wardrobeResult = await client.query(
            'SELECT * FROM clothing_items WHERE user_id = $1 AND id != $2',
            [userId, itemId]
        );

        // Simple matching algorithm
        const recommendations = wardrobeResult.rows
            .map(wardrobeItem => {
                let score = 0;
                let reasons = [];

                // Category matching
                if (item.category === 'top' && wardrobeItem.category === 'bottom') {
                    score += 0.3;
                    reasons.push('Top + bottom combination');
                } else if (item.category === 'bottom' && wardrobeItem.category === 'top') {
                    score += 0.3;
                    reasons.push('Bottom + top combination');
                } else if (item.category === 'dress' && wardrobeItem.category === 'outerwear') {
                    score += 0.25;
                    reasons.push('Dress + outerwear pairing');
                }

                // Color coordination
                const neutralColors = ['black', 'white', 'gray', 'beige', 'navy'];
                if (neutralColors.includes(item.color?.toLowerCase()) ||
                    neutralColors.includes(wardrobeItem.color?.toLowerCase())) {
                    score += 0.2;
                    reasons.push('Neutral color coordination');
                }

                // Same brand bonus
                if (item.brand && item.brand === wardrobeItem.brand) {
                    score += 0.1;
                    reasons.push('Same brand aesthetic');
                }

                return {
                    item: wardrobeItem,
                    score: Math.min(score, 1.0),
                    reasons: reasons.join(', ')
                };
            })
            .filter(rec => rec.score > 0.2)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        // Log activity
        await client.query(
            'INSERT INTO activity_log (user_id, action_type, item_id, metadata) VALUES ($1, $2, $3, $4)',
            [userId, 'ai_check', itemId, JSON.stringify({ recommendations_count: recommendations.length })]
        );

        res.json({
            item: item,
            recommendations: recommendations,
            message: recommendations.length > 0
                ? `Found ${recommendations.length} matching items in your wardrobe!`
                : 'No strong matches found. Try adding more items!'
        });

    } catch (error) {
        console.error('Style check error:', error);
        res.status(500).json({ error: 'Failed to perform style check' });
    } finally {
        client.release();
    }
});

/**
 * @swagger
 * /api/ai/suggest-outfit:
 *   post:
 *     summary: Generate outfit suggestions
 *     tags: [AI Features]
 */
router.post('/suggest-outfit', verifyToken, async (req, res) => {
    const client = await pool.connect();

    try {
        const userId = await getUserId(req.user.uid);
        const { occasion, season } = req.body;

        const result = await client.query(
            'SELECT * FROM clothing_items WHERE user_id = $1',
            [userId]
        );

        if (result.rows.length < 2) {
            return res.status(400).json({
                error: 'Need at least 2 items in wardrobe to create outfits'
            });
        }

        const items = result.rows;
        const tops = items.filter(i => i.category === 'top');
        const bottoms = items.filter(i => i.category === 'bottom');
        const shoes = items.filter(i => i.category === 'shoes');
        const outerwear = items.filter(i => i.category === 'outerwear');

        const outfits = [];

        for (const top of tops.slice(0, 3)) {
            for (const bottom of bottoms.slice(0, 3)) {
                const outfit = {
                    items: [top, bottom],
                    score: 0.7,
                    occasion: occasion || 'casual'
                };

                if (shoes.length > 0) {
                    outfit.items.push(shoes[0]);
                    outfit.score += 0.1;
                }

                if (season === 'winter' && outerwear.length > 0) {
                    outfit.items.push(outerwear[0]);
                    outfit.score += 0.1;
                }

                outfits.push(outfit);
            }
        }

        res.json({
            message: `Generated ${outfits.length} outfit suggestions`,
            outfits: outfits.slice(0, 5),
            occasion: occasion || 'casual',
            season: season || 'all'
        });

    } catch (error) {
        console.error('Outfit suggestion error:', error);
        res.status(500).json({ error: 'Failed to generate outfit suggestions' });
    } finally {
        client.release();
    }
});

/**
 * @swagger
 * /api/ai/usage-stats:
 *   get:
 *     summary: Get AI feature usage statistics
 *     tags: [AI Features]
 */
router.get('/usage-stats', verifyToken, async (req, res) => {
    const client = await pool.connect();

    try {
        const userId = await getUserId(req.user.uid);

        const result = await client.query(
            `SELECT 
        COUNT(*) FILTER (WHERE action_type = 'ai_check') as style_checks,
        COUNT(*) FILTER (WHERE action_type = 'upload_item') as items_uploaded,
        COUNT(*) FILTER (WHERE action_type = 'create_outfit') as outfits_created,
        COUNT(*) FILTER (WHERE action_type = 'tryon') as tryon_count
      FROM activity_log 
      WHERE user_id = $1`,
            [userId]
        );

        res.json({ usage: result.rows[0] });

    } catch (error) {
        console.error('Usage stats error:', error);
        res.status(500).json({ error: 'Failed to fetch usage stats' });
    } finally {
        client.release();
    }
});

module.exports = router;