// src/config/firebase.js
const admin = require('firebase-admin');

// Initialize Firebase Admin
const initializeFirebase = () => {
    try {
        // Option 1: Using environment variables (recommended for production)
        if (process.env.FIREBASE_PRIVATE_KEY) {
            const serviceAccount = {
                type: 'service_account',
                project_id: process.env.FIREBASE_PROJECT_ID,
                private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                client_email: process.env.FIREBASE_CLIENT_EMAIL,
            };

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });

            console.log('✅ Firebase Admin initialized with environment variables');
        }
        // Option 2: Using service account JSON file (for local development)
        else {
            const serviceAccount = require('../../firebase-service-account.json');

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });

            console.log('✅ Firebase Admin initialized with service account file');
        }
    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
        throw error;
    }
};

module.exports = { admin, initializeFirebase };