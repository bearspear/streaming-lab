import express from 'express';
import { getSubtitles, serveSubtitle } from '../controllers/subtitleController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All subtitle routes require authentication
router.use(authenticateToken);

// Get subtitles for a media item
router.get('/media/:mediaId', getSubtitles);

// Serve a specific subtitle file
router.get('/:subtitleId', serveSubtitle);

export default router;
