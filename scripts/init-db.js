#!/usr/bin/env node
// scripts/init-db.js
// Run this script once after deploying to Render to initialize the database schema
// Usage: node scripts/init-db.js

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool(
    process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
        : {
            user: process.env.DB_USER || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'fare_db',
            password: process.env.DB_PASSWORD || 'postgres',
            port: process.env.DB_PORT || 5432,
        }
);

async function initDB() {
    const client = await pool.connect();
    try {
        console.log('🔄 Initializing database schema...');

        const schemaPath = path.join(__dirname, '..', 'schema.sql');
        const migrationPath = path.join(__dirname, '..', 'migrations', '001_tryon.sql');

        // Run schema.sql (excluding DROP TABLE which would delete data if run again)
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        // Replace DROP ... CASCADE with safe version
        const safeSchemaSql = schema.replace(/DROP TABLE IF EXISTS[^;]+;/g, '-- (skipped DROP TABLE for safety)');
        await client.query(safeSchemaSql);
        console.log('✅ schema.sql executed');

        // Run migration
        const migration = fs.readFileSync(migrationPath, 'utf-8');
        await client.query(migration);
        console.log('✅ migrations/001_tryon.sql executed');

        console.log('🎉 Database initialization complete!');
    } catch (error) {
        console.error('❌ DB init error:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

initDB();
