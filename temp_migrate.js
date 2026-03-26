// temp_migrate.js
// Run this to create the otp_verifications table
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting OTP table migration...');
        const sql = `
            CREATE TABLE IF NOT EXISTS otp_verifications (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                otp_code VARCHAR(10) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                verified BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_verifications(email);
        `;
        await client.query(sql);
        console.log('✅ Success: otp_verifications table created!');
    } catch (err) {
        console.error('❌ Error during migration:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
