# FARE Backend - MVP Setup Guide

## 🚀 Quick Start (6 Week Sprint)

### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org/))
- PostgreSQL 15+ ([Download](https://www.postgresql.org/download/))
- Docker & Docker Compose (optional but recommended)
- Accounts needed:
  - [Firebase](https://console.firebase.google.com/) (free tier)
  - [Cloudinary](https://cloudinary.com/) (free tier)
  - [Remove.bg](https://www.remove.bg/api) (free 50 API calls/month)

---

## 📦 Installation

### Option 1: Docker (Recommended - Fastest)

```bash
# 1. Clone/create project
mkdir fare-backend && cd fare-backend

# 2. Copy all files (server.js, routes/, schema.sql, etc.)

# 3. Create .env file
cp .env.example .env
# Edit .env with your credentials

# 4. Start everything with Docker
docker-compose up -d

# 5. Check if running
curl http://localhost:3000/health
```

### Option 2: Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Setup PostgreSQL database
createdb fare_db
psql -U postgres -d fare_db -f schema.sql

# 3. Create .env file
cp .env.example .env
# Edit with your credentials

# 4. Start server
npm run dev

# Server runs at http://localhost:3000
```

---

## 🔑 Configuration

### 1. Firebase Setup
```bash
# Go to Firebase Console → Project Settings → Service Accounts
# Generate new private key → Download JSON

# Add to .env:
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
```

### 2. Cloudinary Setup
```bash
# Go to https://cloudinary.com/console
# Copy from Dashboard

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=123456789
CLOUDINARY_API_SECRET=your_secret
```

### 3. Remove.bg API (Optional for MVP)
```bash
# Get free API key from https://www.remove.bg/users/sign_up
REMOVEBG_API_KEY=your_api_key
```

---

## 📡 API Endpoints

### Authentication
```bash
# Register new user
POST /api/auth/register
Headers: Authorization: Bearer <firebase_token>
Body: {
  "email": "user@example.com",
  "displayName": "John Doe",
  "height": 175,
  "weight": 70,
  "gender": "male"
}

# Get user profile
GET /api/auth/profile
Headers: Authorization: Bearer <firebase_token>

# Update profile
PUT /api/auth/profile
Headers: Authorization: Bearer <firebase_token>
Body: { "displayName": "New Name", "height": 180 }
```

### Wardrobe Management
```bash
# Upload clothing item
POST /api/wardrobe/items
Headers: Authorization: Bearer <firebase_token>
Content-Type: multipart/form-data
Body: {
  "image": <file>,
  "name": "Blue T-Shirt",
  "category": "top",
  "brand": "Uniqlo",
  "color": "blue",
  "size": "M"
}

# Get all items
GET /api/wardrobe/items
GET /api/wardrobe/items?category=top
GET /api/wardrobe/items?favorite=true

# Get single item
GET /api/wardrobe/items/:id

# Update item
PUT /api/wardrobe/items/:id
Body: { "favorite": true, "name": "Updated Name" }

# Delete item
DELETE /api/wardrobe/items/:id

# Get wardrobe stats
GET /api/wardrobe/stats
```

### AI Features
```bash
# AI Style Check - find matching items
POST /api/ai/style-check
Body: { "itemId": 123 }

# Suggest outfits
POST /api/ai/suggest-outfit
Body: { 
  "occasion": "work",
  "season": "summer"
}

# Remove background (optional)
POST /api/ai/remove-background
Body: { "imageUrl": "https://..." }

# Get AI usage stats
GET /api/ai/usage-stats
```

---

## 🧪 Testing APIs

### Using cURL
```bash
# Health check
curl http://localhost:3000/health

# Register (need Firebase token first)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","displayName":"Test User"}'
```

### Using Postman
1. Import collection from `postman_collection.json` (create this)
2. Set environment variable `{{baseUrl}}` = `http://localhost:3000`
3. Get Firebase token from your mobile app
4. Add to Headers: `Authorization: Bearer {{token}}`

---

## 📊 Database Schema

```sql
users (
  id, firebase_uid, email, display_name,
  height, weight, gender,
  preferred_brands[], preferred_colors[],
  subscription_tier, created_at
)

clothing_items (
  id, user_id, name, category, brand, color, size,
  original_image_url, processed_image_url,
  ai_tags[], favorite, times_worn
)

outfits (
  id, user_id, name, occasion, season,
  item_ids[], preview_image_url
)

activity_log (
  id, user_id, action_type, item_id, metadata
)
```

---

## 🐛 Troubleshooting

### "Connection refused" error
```bash
# Check if PostgreSQL is running
docker-compose ps
# or
pg_isready

# Restart database
docker-compose restart postgres
```

### Firebase authentication fails
```bash
# Verify your Firebase config in .env
# Make sure private key has \n newlines properly escaped
```

### Image upload fails
```bash
# Check Cloudinary credentials
# Verify file size < 10MB
# Check multer configuration
```

---

## 📈 Next Steps (After MVP)

- [ ] Implement real AI model for virtual try-on
- [ ] Add Redis caching for faster responses
- [ ] Implement outfit recommendations algorithm
- [ ] Add analytics tracking
- [ ] Set up CI/CD pipeline
- [ ] Deploy to production (AWS/GCP/Railway)

---

## 🎯 MVP Timeline (6 Weeks)

**Week 1-2**: ✅ Backend setup (DONE)
- Authentication
- Database schema
- Basic CRUD APIs

**Week 3-4**: Frontend Mobile App
- React Native setup
- Camera integration
- Wardrobe UI

**Week 5**: AI Integration
- Remove.bg API
- Basic matching algorithm
- Outfit suggestions

**Week 6**: Testing & Polish
- Bug fixes
- Performance optimization
- Deploy to TestFlight/Internal Testing

---

## 📞 Support

Need help? Create an issue or contact the team!

**Tech Stack**: Node.js + Express + PostgreSQL + Firebase + Cloudinary + React Native