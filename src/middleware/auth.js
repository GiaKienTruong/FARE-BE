// src/middleware/auth.js
// Re-export authentication middleware from routes/auth.js for convenience

const { verifyToken } = require('../routes/auth');

// Middleware to authenticate and add user info to request
const authenticateToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            return res.status(401).json({
                error: { message: 'Token xác thực không được cung cấp', status: 401 }
            });
        }

        const { admin } = require('../config/firebase');
        const pool = require('../config/database');

        // Verify Firebase token
        const decodedToken = await admin.auth().verifyIdToken(token);

        // Get user from database
        const result = await pool.query(
            'SELECT id, email, display_name, subscription_tier FROM users WHERE firebase_uid = $1',
            [decodedToken.uid]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                error: { message: 'Người dùng không tồn tại trong hệ thống', status: 401 }
            });
        }

        // Attach user info to request
        req.user = {
            ...decodedToken,
            id: result.rows[0].id,
            email: result.rows[0].email,
            displayName: result.rows[0].display_name,
            subscriptionTier: result.rows[0].subscription_tier
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({
            error: { message: 'Token không hợp lệ hoặc đã hết hạn', status: 401 }
        });
    }
};

module.exports = {
    verifyToken,
    authenticateToken
};
