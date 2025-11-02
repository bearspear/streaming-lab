import express from 'express';
import {
  getMovies,
  getTVShows,
  getTVShowDetails,
  getNextEpisode,
  getPreviousEpisode,
  searchMedia,
  getMediaItem,
  scanLibrary,
  getScanProgress,
  deleteMediaItem
} from '../controllers/libraryController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All library routes require authentication
router.use(authenticateToken);

router.get('/movies', getMovies);
router.get('/tvshows', getTVShows);
router.get('/tvshow/:id', getTVShowDetails);
router.get('/episode/:episodeId/next', getNextEpisode);
router.get('/episode/:episodeId/previous', getPreviousEpisode);
router.get('/search', searchMedia);
router.get('/item/:id', getMediaItem);
router.post('/scan', scanLibrary);
router.get('/scan/progress', getScanProgress);
router.delete('/item/:id', deleteMediaItem);

export default router;
