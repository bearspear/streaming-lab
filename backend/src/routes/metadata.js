import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as metadataController from '../controllers/metadataController.js';

const router = express.Router();

// All metadata routes require authentication
router.use(authenticateToken);

// Metadata fetching routes
router.post('/fetch/:id', metadataController.fetchMetadata);
router.post('/batch-fetch', metadataController.batchFetchMetadata);
router.post('/manual-match/:id', metadataController.manualMatch);
router.post('/refresh/:id', metadataController.refreshMetadata);

// Parsing and search routes
router.post('/parse-filename', metadataController.parseFilename);
router.get('/search', metadataController.searchTMDB);

// TMDB direct access routes
router.get('/tmdb/movie/:tmdbId', metadataController.getTMDBMovie);
router.get('/tmdb/tv/:tmdbId', metadataController.getTMDBTVShow);

// Watch history and progress routes
router.post('/watch/progress', metadataController.updateWatchProgress);
router.get('/watch/progress/:mediaItemId', metadataController.getWatchProgress);
router.post('/watch/mark-watched/:mediaItemId', metadataController.markAsWatched);
router.delete('/watch/mark-unwatched/:mediaItemId', metadataController.markAsUnwatched);
router.get('/watch/continue-watching', metadataController.getContinueWatching);
router.get('/watch/recently-watched', metadataController.getRecentlyWatched);
router.get('/watch/history', metadataController.getWatchHistory);
router.get('/watch/stats', metadataController.getWatchStats);
router.post('/watch/reset/:mediaItemId', metadataController.resetWatchProgress);

export default router;
