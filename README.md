# StreamFlix - Personal Media Streaming Server

A Netflix-inspired, self-hosted media streaming platform with advanced features including network source browsing, TV show episode tracking, subtitle support, and comprehensive admin controls.

## Features

### Media Management
- **Movies & TV Shows**: Automatic organization and metadata fetching
- **Episode Tracking**: Season and episode navigation for TV series
- **Continue Watching**: Resume playback from where you left off
- **Progress Tracking**: Automatic viewing progress sync across devices
- **Multiple Quality Options**: Adaptive streaming with quality selection

### Video Playback
- **Advanced Video Player**: Video.js-based player with custom controls
- **Subtitle Support**: Multi-language subtitle tracks with external SRT files
- **Quality Switching**: Dynamic quality selection during playback
- **Keyboard Controls**: Full keyboard shortcuts for playback control
- **Responsive Design**: Mobile, tablet, and desktop optimized

### Network Explorer
- **Multi-Protocol Support**: Browse FTP, SMB/CIFS, and UPnP/DLNA sources
- **Directory Browser**: Navigate remote filesystems in real-time
- **Connection Testing**: Verify network sources before adding
- **Device Discovery**: Automatic UPnP/DLNA media server detection
- **Secure Credentials**: Encrypted password storage with bcrypt

### Administration
- **User Management**: Create, manage, and delete users
- **Admin Controls**: Role-based access with admin privileges
- **Library Statistics**: Real-time stats on media, users, and storage
- **Media Management**: Bulk operations, cleanup, and organization
- **System Health**: Monitor missing files and library integrity

### Search & Discovery
- **Global Search**: Fast search across all movies and TV shows
- **Metadata Display**: Rich media information with posters and descriptions
- **Smart Filtering**: Filter by type, year, genre
- **Recently Added**: Track new content additions

## Tech Stack

### Backend
- **Runtime**: Node.js with Express.js
- **Database**: SQLite with better-sqlite3
- **Authentication**: JWT-based auth with bcrypt password hashing
- **Video Processing**: FFmpeg for transcoding and quality variants
- **Protocol Clients**:
  - FTP (basic-ftp)
  - SMB/CIFS (@marsaud/smb2)
  - UPnP/DLNA (node-ssdp)

### Frontend
- **Framework**: Angular 17 (Standalone Components)
- **Language**: TypeScript
- **Styling**: SCSS with Netflix-inspired design
- **HTTP Client**: Angular HttpClient with RxJS
- **Video Player**: Video.js with custom skin
- **Icons**: Lucide Icons (SVG)

### Additional Tools
- **Metadata**: TMDB API integration
- **Subtitle Parsing**: subtitle library
- **Video Streaming**: HLS support with adaptive bitrate

## Prerequisites

- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **FFmpeg**: Required for video transcoding
- **SQLite**: Included with better-sqlite3

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd streaming-lab
```

### 2. Install Backend Dependencies
```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies
```bash
cd ../frontend
npm install
```

### 4. Environment Configuration

Create `.env` file in the backend directory:

```env
# Server Configuration
PORT=4000
NODE_ENV=development

# JWT Secret (change in production!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# TMDB API Key (optional, for metadata fetching)
TMDB_API_KEY=your_tmdb_api_key_here

# Media Directories
MOVIES_PATH=/path/to/your/movies
TV_SHOWS_PATH=/path/to/your/tv-shows

# Database Path
DATABASE_PATH=./data/media_library.db

# Transcoding Settings
ENABLE_TRANSCODING=true
TRANSCODE_CACHE_DIR=./cache/transcoded
```

### 5. Create Required Directories
```bash
# In backend directory
mkdir -p data cache/transcoded
```

## Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Server runs on: `http://localhost:4000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```
Application runs on: `http://localhost:4202`

### Production Mode

**Backend:**
```bash
cd backend
npm start
```

**Frontend Build:**
```bash
cd frontend
npm run build
# Serve the dist/frontend directory with a web server
```

## Project Structure

```
streaming-lab/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js          # Database schema and migrations
│   │   ├── controllers/
│   │   │   ├── authController.js    # Authentication logic
│   │   │   ├── adminController.js   # Admin panel endpoints
│   │   │   ├── libraryController.js # Media library management
│   │   │   ├── streamController.js  # Video streaming
│   │   │   └── networkController.js # Network source browsing
│   │   ├── middleware/
│   │   │   ├── auth.js              # JWT authentication
│   │   │   └── adminAuth.js         # Admin authorization
│   │   ├── routes/
│   │   │   ├── auth.js              # Auth routes
│   │   │   ├── admin.js             # Admin routes
│   │   │   ├── library.js           # Library routes
│   │   │   ├── stream.js            # Streaming routes
│   │   │   ├── metadata.js          # Metadata routes
│   │   │   ├── subtitles.js         # Subtitle routes
│   │   │   └── network.js           # Network routes
│   │   ├── services/
│   │   │   ├── scanner.js           # Media library scanner
│   │   │   ├── transcoder.js        # Video transcoding
│   │   │   ├── metadata.js          # TMDB metadata fetcher
│   │   │   └── protocols/           # Network protocol clients
│   │   │       ├── BaseProtocolClient.js
│   │   │       ├── FTPClient.js
│   │   │       ├── SMBClient.js
│   │   │       └── UPnPClient.js
│   │   └── server.js                # Express app entry point
│   ├── data/                        # SQLite database storage
│   ├── cache/                       # Transcoded video cache
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── login/           # Login component
│   │   │   │   ├── register/        # Registration component
│   │   │   │   ├── library/         # Main library view
│   │   │   │   ├── video-player/    # Video player component
│   │   │   │   ├── media-details/   # Movie details
│   │   │   │   ├── tv-show-details/ # TV show details
│   │   │   │   ├── search/          # Search interface
│   │   │   │   ├── admin/           # Admin dashboard
│   │   │   │   └── media-card/      # Reusable media card
│   │   │   ├── core/
│   │   │   │   ├── guards/          # Route guards
│   │   │   │   ├── interceptors/    # HTTP interceptors
│   │   │   │   ├── models/          # TypeScript interfaces
│   │   │   │   └── services/        # API services
│   │   │   ├── app.component.ts
│   │   │   ├── app.routes.ts
│   │   │   └── app.config.ts
│   │   ├── styles.scss              # Global styles
│   │   └── environments/            # Environment configs
│   └── package.json
│
├── test-videos/                     # Test media files
│   ├── movies/
│   └── tv-shows/
│
└── docs/                            # Documentation
    ├── network-explorer.md          # Network Explorer guide
    └── api-documentation.md         # API reference
```

## First-Time Setup

### 1. Create Admin User

After starting the backend, use the SQLite CLI or create a user through the registration endpoint:

```bash
# Using SQLite CLI
cd backend
sqlite3 data/media_library.db
```

```sql
-- Set a user as admin
UPDATE users SET is_admin = 1 WHERE username = 'your_username';
```

Or use the API:
```bash
# Register a new user
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secure_password"}'

# Then set as admin in database
```

### 2. Scan Media Library

The scanner automatically runs on startup and checks for new media every 30 minutes. To manually trigger:

```bash
# Backend logs will show:
# "Starting media library scan..."
# "Scan complete: X movies, Y TV shows"
```

### 3. Add Network Sources (Optional)

1. Navigate to `http://localhost:4202/admin`
2. Click "Network Sources" tab
3. Add FTP, SMB, or other network sources
4. Browse and import media from remote locations

## Key Features in Detail

### Video Playback

The video player supports:
- **Play/Pause**: Spacebar or click
- **Seek**: Arrow keys or progress bar
- **Volume**: Up/Down arrows or volume slider
- **Fullscreen**: F key or fullscreen button
- **Quality Selection**: Gear icon for quality options
- **Subtitles**: CC button for subtitle tracks

### TV Show Navigation

TV shows are organized by:
- **Seasons**: Collapsible season sections
- **Episodes**: Grid view with episode numbers and titles
- **Progress**: Visual indicators for watched episodes
- **Auto-play**: Automatic next episode detection

### Subtitle Management

Subtitle files are:
- Auto-discovered if named correctly: `movie.en.srt`, `movie.es.srt`
- Selectable from player controls
- Support for multiple languages
- SRT format parsing with timestamps

### Network Source Browsing

Browse remote media sources:
- **FTP Servers**: Connect with credentials, browse directories
- **SMB/CIFS Shares**: Windows network shares support
- **UPnP/DLNA**: Auto-discover media servers on local network
- **Test Connections**: Verify before saving
- **Secure Storage**: Passwords encrypted with bcrypt

## API Documentation

### Authentication Endpoints

```
POST /api/auth/register      # Register new user
POST /api/auth/login         # Login and get JWT
GET  /api/auth/verify        # Verify JWT token
```

### Library Endpoints

```
GET  /api/library/movies              # List all movies
GET  /api/library/tvshows             # List all TV shows
GET  /api/library/item/:id            # Get media item details
GET  /api/library/tvshow/:id/seasons  # Get TV show seasons
POST /api/library/scan                # Trigger library scan
```

### Streaming Endpoints

```
GET  /api/stream/:id/direct           # Direct video stream
GET  /api/stream/:id/qualities        # Available quality options
GET  /api/stream/:id/transcode        # Transcoded stream
```

### Admin Endpoints (Require Admin Role)

```
GET    /api/admin/dashboard           # Dashboard statistics
GET    /api/admin/users               # List users
DELETE /api/admin/users/:id           # Delete user
PUT    /api/admin/users/:id/admin     # Toggle admin status
GET    /api/admin/library/stats       # Library statistics
GET    /api/admin/media               # List all media (paginated)
DELETE /api/admin/media/:id           # Delete media item
```

### Network Endpoints

```
GET    /api/network/sources           # List network sources
POST   /api/network/sources           # Create network source
GET    /api/network/sources/:id       # Get network source
PUT    /api/network/sources/:id       # Update network source
DELETE /api/network/sources/:id       # Delete network source
POST   /api/network/sources/:id/test  # Test connection
GET    /api/network/sources/:id/browse?path=/path  # Browse directory
POST   /api/network/discover          # Discover UPnP devices
```

Full API documentation: [docs/api-documentation.md](docs/api-documentation.md)

## Configuration

### Video Quality Settings

Edit `backend/src/services/transcoder.js` to configure:
- Available quality presets (1080p, 720p, 480p, 360p)
- Bitrate settings
- Codec preferences
- Cache settings

### Scanner Settings

Edit `backend/src/services/scanner.js`:
- Scan interval (default: 30 minutes)
- File extensions to scan
- Metadata fetch options

### Frontend Theming

Customize colors in `frontend/src/styles.scss`:
```scss
:root {
  --primary-color: #e50914;      // Netflix red
  --background-dark: #141414;    // Dark background
  --text-primary: #ffffff;       // White text
  --text-secondary: #b3b3b3;     // Gray text
}
```

## Development

### Running Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Code Style

- **Backend**: ESLint with Airbnb config
- **Frontend**: Angular ESLint + Prettier
- Run linting: `npm run lint`

### Building for Production

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
# Output: dist/frontend/
```

### Docker Deployment (Optional)

```dockerfile
# Example Dockerfile for backend
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 4000
CMD ["npm", "start"]
```

## Troubleshooting

### Video Won't Play
- Verify FFmpeg is installed: `ffmpeg -version`
- Check file permissions on media directories
- Review backend logs for transcoding errors

### Metadata Not Loading
- Verify TMDB API key in `.env`
- Check internet connectivity
- Review rate limiting (40 requests/10 seconds)

### Network Source Connection Failed
- Test connectivity: `nc -zv host port`
- Verify credentials are correct
- Check firewall rules
- Review [docs/network-explorer.md](docs/network-explorer.md)

### Database Errors
- Backup database: `cp data/media_library.db data/media_library.db.backup`
- Check file permissions
- Verify schema with: `sqlite3 data/media_library.db .schema`

### Frontend Build Fails
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version`
- Verify Angular CLI: `npx ng version`

## Security Considerations

### Production Checklist
- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Use HTTPS (TLS/SSL) for all connections
- [ ] Enable CORS only for trusted domains
- [ ] Set strong password requirements
- [ ] Regularly update dependencies
- [ ] Enable rate limiting on auth endpoints
- [ ] Use environment variables (never commit secrets)
- [ ] Set secure HTTP headers (helmet.js)
- [ ] Regular database backups
- [ ] Monitor logs for suspicious activity

### Network Security
- Use VPN for remote access
- Restrict network source access to trusted IPs
- Enable firewall rules for exposed ports
- Use strong passwords for network shares
- Regularly audit admin user list

## Performance Optimization

### Backend
- Enable video caching for frequently watched content
- Use CDN for static assets
- Implement Redis for session storage
- Enable gzip compression
- Database indexing on frequently queried fields

### Frontend
- Lazy loading for routes
- Image optimization with WebP
- Service worker for offline support
- Code splitting and tree shaking
- Preload critical resources

## Roadmap

### Planned Features
- [ ] Multi-user watchlists
- [ ] Recommendations engine
- [ ] Parental controls
- [ ] Watch parties (synchronized viewing)
- [ ] Mobile apps (iOS/Android)
- [ ] Chromecast/AirPlay support
- [ ] Download for offline viewing
- [ ] Custom collections/playlists
- [ ] Social features (ratings, reviews)
- [ ] Integration with Plex/Jellyfin metadata

### Future Enhancements
- [ ] AI-powered content recommendations
- [ ] Automatic trailer downloads
- [ ] Cloud storage integration (S3, Google Drive)
- [ ] Multi-language interface
- [ ] Dark/Light theme toggle
- [ ] Advanced search filters
- [ ] Content age ratings
- [ ] Viewing statistics and analytics

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Contribution Guidelines
- Follow existing code style
- Add tests for new features
- Update documentation
- Keep commits atomic and descriptive
- Ensure all tests pass before submitting

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- **TMDB** - Movie and TV show metadata
- **Video.js** - Video player framework
- **Angular Team** - Frontend framework
- **Express.js** - Backend framework
- **FFmpeg** - Video processing
- **Netflix** - UI/UX inspiration

## Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Check existing documentation in `/docs`
- Review troubleshooting section above

## Author

Michael Behringer

---

**Note**: This is a personal media server. Please respect copyright laws and only stream content you own or have rights to access.
