// src/config/database.js
const { Pool } = require('pg');

const pool = new Pool(
    // Render provides a single DATABASE_URL string
    // Local dev uses individual variables from docker-compose
    process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }, // Required for Render PostgreSQL
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        }
        : {
            user: process.env.DB_USER || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'fare_db',
            password: process.env.DB_PASSWORD || 'postgres',
            port: process.env.DB_PORT || 5432,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        }
);

// Test connection
pool.on('connect', () => {
    console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
    process.exit(-1);
});

module.exports = pool;