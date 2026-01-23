-- Migration: 001_tryon.sql
-- Description: Create tables for AI virtual try-on feature

-- Bảng lưu kết quả try-on
CREATE TABLE IF NOT EXISTS tryon_results (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    person_image_url TEXT NOT NULL,
    garment_id INTEGER,
    garment_image_url TEXT NOT NULL,
    result_image_url TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    processing_time_ms INTEGER,
    model_version VARCHAR(50) DEFAULT 'catvton-v1',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Bảng lưu ảnh người dùng (body photos)
CREATE TABLE IF NOT EXISTS user_body_photos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    is_default BOOLEAN DEFAULT false,
    body_type VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index cho performance
CREATE INDEX IF NOT EXISTS idx_tryon_user ON tryon_results(user_id);
CREATE INDEX IF NOT EXISTS idx_tryon_status ON tryon_results(status);
CREATE INDEX IF NOT EXISTS idx_tryon_created ON tryon_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_body_photos_user ON user_body_photos(user_id);

-- Trigger để tự động update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_tryon_results_updated_at ON tryon_results;
CREATE TRIGGER update_tryon_results_updated_at
    BEFORE UPDATE ON tryon_results
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
