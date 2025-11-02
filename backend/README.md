# Media Streaming Server - Backend

A Plex-like media streaming server backend with support for local filesystem scanning, authentication, and library management.

## Phase 1 - Core Foundation ✅

The initial phase has been completed with the following features:

### Implemented Features

1. **Node.js/Express Backend Structure**
   - ES modules setup
   - Express server with middleware configuration
   - CORS support
   - Request logging
   - Error handling

2. **SQLite Database**
   - Complete database schema with tables for:
     - Media items (movies, TV shows, episodes)
     - Network sources
     - Watch history
     - Users
   - Database initialization on startup
   - Performance indexes

3. **Authentication System**
   - JWT-based authentication
   - User registration and login
   - Password hashing with bcrypt
   - Protected route middleware
   - Token verification

4. **REST API Endpoints**
   - `GET /health` - Health check
   - `GET /api` - API information
   - `POST /api/auth/register` - User registration
   - `POST /api/auth/login` - User login
   - `GET /api/auth/verify` - Token verification
   - `GET /api/library/movies` - Get all movies
   - `GET /api/library/item/:id` - Get media item details
   - `POST /api/library/scan` - Start directory scan
   - `GET /api/library/scan/progress` - Get scan progress
   - `DELETE /api/library/item/:id` - Delete media item

5. **Local Filesystem Scanner**
   - Recursive directory scanning
   - Video file detection (mp4, mkv, avi, mov, wmv, flv, webm)
   - Automatic title extraction from filenames
   - Database integration
   - Scan progress tracking

## Installation

```bash
npm install
```

## Configuration

Edit the `.env` file to configure the server:

```env
PORT=4000
NODE_ENV=development
DATABASE_PATH=./data/media_library.db
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRATION=7d
VIDEO_EXTENSIONS=.mp4,.mkv,.avi,.mov,.wmv,.flv,.webm
```

## Running the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Usage Examples

### Register a User
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"password123"}'
```

### Login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"password123"}'
```

### Get Movies (requires authentication)
```bash
curl http://localhost:4000/api/library/movies \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Scan Directory (requires authentication)
```bash
curl -X POST http://localhost:4000/api/library/scan \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"path":"/path/to/your/videos"}'
```

## Project Structure

```
backend/
├── src/
│   ├── server.js              # Main server entry point
│   ├── config/
│   │   └── database.js        # Database configuration and schema
│   ├── controllers/
│   │   ├── authController.js  # Authentication logic
│   │   └── libraryController.js # Library management logic
│   ├── middleware/
│   │   └── auth.js            # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js            # Authentication routes
│   │   └── library.js         # Library routes
│   ├── services/
│   │   └── scannerService.js  # Filesystem scanning service
│   └── utils/                 # Utility functions
├── data/                      # Database files
├── .env                       # Environment configuration
├── .env.example               # Environment configuration example
└── package.json               # Dependencies and scripts
```

## Next Steps (Phase 2)

The following features are planned for Phase 2:

- Direct streaming with range request support
- FFmpeg integration for transcoding
- HLS streaming pipeline
- Video quality detection
- Transcoded segment caching

## Testing

The backend has been tested with the following scenarios:

- ✅ Health check endpoint
- ✅ User registration
- ✅ User login
- ✅ Token verification
- ✅ Protected routes (authentication middleware)
- ✅ Library endpoint (empty database)

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: SQLite3
- **Authentication**: JWT + bcrypt
- **Dev Tools**: Nodemon
