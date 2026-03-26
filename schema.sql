-- FARE Backend Database Schema
-- PostgreSQL 15+

-- Drop tables if exist (for fresh install)
DROP TABLE IF EXISTS activity_log CASCADE;
DROP TABLE IF EXISTS style_recommendations CASCADE;
DROP TABLE IF EXISTS outfits CASCADE;
DROP TABLE IF EXISTS tryon_results CASCADE;
DROP TABLE IF EXISTS user_body_photos CASCADE;
DROP TABLE IF EXISTS clothing_items CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  firebase_uid VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  phone VARCHAR(20),
  
  -- Body measurements
  height INTEGER, -- cm
  weight INTEGER, -- kg
  gender VARCHAR(20),
  
  -- Preferences
  preferred_brands TEXT[], -- ["Uniqlo", "Zara"]
  preferred_colors TEXT[], -- ["black", "white", "blue"]
  preferred_styles TEXT[], -- ["casual", "formal", "streetwear"]
  
  -- Subscription
  subscription_tier VARCHAR(20) DEFAULT 'free', -- 'free' or 'premium'
  subscription_expires_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clothing items (wardrobe)
CREATE TABLE clothing_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  
  -- Item details
  name VARCHAR(255),
  category VARCHAR(50) NOT NULL, -- 'top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'
  subcategory VARCHAR(50), -- 'tshirt', 'jeans', 'sneakers', etc.
  
  brand VARCHAR(100),
  color VARCHAR(50),
  size VARCHAR(20), -- 'S', 'M', 'L', 'XL'
  
  -- Images
  original_image_url TEXT NOT NULL,
  processed_image_url TEXT, -- background removed
  thumbnail_url TEXT,
  
  -- AI metadata
  ai_tags TEXT[], -- ["casual", "summer", "cotton"]
  dominant_colors TEXT[], -- ["#FF5733", "#C70039"]
  
  -- Usage tracking
  times_worn INTEGER DEFAULT 0,
  last_worn_at TIMESTAMP,
  favorite BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Outfit combinations
CREATE TABLE outfits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  occasion VARCHAR(50), -- 'work', 'casual', 'party', 'date'
  season VARCHAR(20), -- 'spring', 'summer', 'fall', 'winter'
  
  -- Items in this outfit (JSON array of item IDs)
  item_ids INTEGER[] NOT NULL,
  
  -- Preview image
  preview_image_url TEXT,
  
  favorite BOOLEAN DEFAULT false,
  times_worn INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Try-on results (Virtual Try-On feature)
CREATE TABLE tryon_results (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  person_image_url TEXT NOT NULL,
  garment_id INTEGER REFERENCES clothing_items(id) ON DELETE SET NULL,
  garment_image_url TEXT NOT NULL,
  result_image_url TEXT,
  
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  error_message TEXT,
  processing_time_ms INTEGER,
  model_version VARCHAR(50) DEFAULT 'catvton-v1',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User body photos (for try-on)
CREATE TABLE user_body_photos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  is_default BOOLEAN DEFAULT false,
  body_type VARCHAR(20), -- 'slim', 'athletic', 'average', etc.
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Style recommendations (cached AI suggestions)
CREATE TABLE style_recommendations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES clothing_items(id) ON DELETE CASCADE,
  
  recommended_item_ids INTEGER[], -- items that go well with this
  recommendation_score DECIMAL(3,2), -- 0.00 to 1.00
  reason TEXT, -- "These colors complement each other"
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OTP Verifications table
CREATE TABLE otp_verifications (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  otp_code VARCHAR(10) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User activity log
CREATE TABLE activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  
  action_type VARCHAR(50) NOT NULL, -- 'view_item', 'create_outfit', 'ai_check', 'tryon'
  item_id INTEGER,
  metadata JSONB, -- additional data
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_clothing_items_user_id ON clothing_items(user_id);
CREATE INDEX idx_clothing_items_category ON clothing_items(category);
CREATE INDEX idx_outfits_user_id ON outfits(user_id);
CREATE INDEX idx_tryon_user ON tryon_results(user_id);
CREATE INDEX idx_tryon_status ON tryon_results(status);
CREATE INDEX idx_tryon_created ON tryon_results(created_at DESC);
CREATE INDEX idx_body_photos_user ON user_body_photos(user_id);
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clothing_items_updated_at 
  BEFORE UPDATE ON clothing_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_outfits_updated_at 
  BEFORE UPDATE ON outfits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tryon_results_updated_at
  BEFORE UPDATE ON tryon_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert test data (optional - for development)
-- Uncomment if you want sample data

-- INSERT INTO users (firebase_uid, email, display_name, height, weight, gender) 
-- VALUES ('test-uid-123', 'test@fare.com', 'Test User', 175, 70, 'male');

COMMIT;