import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import database from './config/database.js';
import authRoutes from './routes/auth.js';
import libraryRoutes from './routes/library.js';
import streamRoutes from './routes/stream.js';
import networkRoutes from './routes/network.js';
import metadataRoutes from './routes/metadata.js';
import subtitleRoutes from './routes/subtitles.js';
import adminRoutes from './routes/admin.js';

// Load environment variables
dotenv.config();

// ES module path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Media Streaming Server'
  });
});

// API routes
app.get('/api', (req, res) => {
  res.json({
    message: 'Media Streaming Server API',
    version: '1.0.0'
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/metadata', metadataRoutes);
app.use('/api/subtitles', subtitleRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    await database.initialize();

    // Start server
    app.listen(PORT, () => {
      console.log(`\n🚀 Media Streaming Server running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`📍 API endpoint: http://localhost:${PORT}/api\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\nShutting down gracefully...');
  await database.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\nShutting down gracefully...');
  await database.close();
  process.exit(0);
});

startServer();

export default app;
