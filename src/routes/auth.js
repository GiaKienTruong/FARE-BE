// routes/auth.js - Authentication Routes
const express = require('express');
const router = express.Router();
const { admin } = require('../config/firebase');
const pool = require('../config/database');

// Middleware to verify Firebase token
const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// POST /api/auth/register - Create user profile after Firebase signup
router.post('/register', verifyToken, async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            email,
            displayName,
            phone,
            height,
            weight,
            gender
        } = req.body;

        const firebaseUid = req.user.uid;

        // Check if user already exists
        const existingUser = await client.query(
            'SELECT id FROM users WHERE firebase_uid = $1',
            [firebaseUid]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Insert new user
        const result = await client.query(
            `INSERT INTO users (
        firebase_uid, email, display_name, phone, 
        height, weight, gender, subscription_tier
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, email, display_name, subscription_tier, created_at`,
            [firebaseUid, email, displayName, phone, height, weight, gender, 'free']
        );

        res.status(201).json({
            message: 'User registered successfully',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    } finally {
        client.release();
    }
});

// GET /api/auth/profile - Get user profile
router.get('/profile', verifyToken, async (req, res) => {
    const client = await pool.connect();

    try {
        const result = await client.query(
            `SELECT 
        id, email, display_name, phone, 
        height, weight, gender,
        preferred_brands, preferred_colors, preferred_styles,
        subscription_tier, subscription_expires_at,
        created_at, updated_at
      FROM users 
      WHERE firebase_uid = $1`,
            [req.user.uid]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get wardrobe stats
        const statsResult = await client.query(
            `SELECT 
        COUNT(*) as total_items,
        COUNT(*) FILTER (WHERE favorite = true) as favorite_items
      FROM clothing_items 
      WHERE user_id = $1`,
            [result.rows[0].id]
        );

        res.json({
            user: result.rows[0],
            stats: statsResult.rows[0]
        });

    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    } finally {
        client.release();
    }
});

// PUT /api/auth/profile - Update user profile
router.put('/profile', verifyToken, async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            displayName,
            phone,
            height,
            weight,
            gender,
            preferredBrands,
            preferredColors,
            preferredStyles
        } = req.body;

        const result = await client.query(
            `UPDATE users SET
        display_name = COALESCE($1, display_name),
        phone = COALESCE($2, phone),
        height = COALESCE($3, height),
        weight = COALESCE($4, weight),
        gender = COALESCE($5, gender),
        preferred_brands = COALESCE($6, preferred_brands),
        preferred_colors = COALESCE($7, preferred_colors),
        preferred_styles = COALESCE($8, preferred_styles),
        updated_at = CURRENT_TIMESTAMP
      WHERE firebase_uid = $9
      RETURNING id, email, display_name, updated_at`,
            [displayName, phone, height, weight, gender,
                preferredBrands, preferredColors, preferredStyles,
                req.user.uid]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            message: 'Profile updated successfully',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    } finally {
        client.release();
    }
});

// Export middleware for use in other routes
module.exports = router;
module.exports.verifyToken = verifyToken;