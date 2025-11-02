import metadataService from '../services/metadata/metadataService.js';
import watchHistoryService from '../services/watchHistoryService.js';
import tmdbService from '../services/metadata/tmdbService.js';
import filenameParser from '../services/metadata/filenameParser.js';
import database from '../config/database.js';

/**
 * Fetch metadata for a media item
 * POST /api/metadata/fetch/:id
 */
export const fetchMetadata = async (req, res) => {
  try {
    const { id } = req.params;

    // Get media item
    const mediaItem = await database.get(
      'SELECT * FROM media_items WHERE id = ?',
      [id]
    );

    if (!mediaItem) {
      return res.status(404).json({ error: 'Media item not found' });
    }

    // Process and fetch metadata
    const metadata = await metadataService.processMediaFile(
      mediaItem.file_path,
      id
    );

    res.json({
      success: true,
      mediaItemId: id,
      metadata
    });
  } catch (error) {
    console.error('Error fetching metadata:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Batch fetch metadata for multiple items
 * POST /api/metadata/batch-fetch
 */
export const batchFetchMetadata = async (req, res) => {
  try {
    const { mediaItemIds } = req.body;

    if (!Array.isArray(mediaItemIds)) {
      return res.status(400).json({ error: 'mediaItemIds must be an array' });
    }

    // Get all media items
    const placeholders = mediaItemIds.map(() => '?').join(',');
    const mediaItems = await database.all(
      `SELECT id, file_path FROM media_items WHERE id IN (${placeholders})`,
      mediaItemIds
    );

    // Process in batch
    const results = await metadataService.batchProcess(
      mediaItems,
      (progress) => {
        console.log(`Progress: ${progress.current}/${progress.total}`);
      }
    );

    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error batch fetching metadata:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Manually match media item to TMDB ID
 * POST /api/metadata/manual-match/:id
 */
export const manualMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { tmdbId, type } = req.body;

    if (!tmdbId || !type) {
      return res.status(400).json({ error: 'tmdbId and type are required' });
    }

    if (!['movie', 'tv'].includes(type)) {
      return res.status(400).json({ error: 'type must be "movie" or "tv"' });
    }

    const metadata = await metadataService.manualMatch(
      parseInt(id),
      parseInt(tmdbId),
      type
    );

    res.json({
      success: true,
      metadata
    });
  } catch (error) {
    console.error('Error in manual match:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Refresh metadata for a media item
 * POST /api/metadata/refresh/:id
 */
export const refreshMetadata = async (req, res) => {
  try {
    const { id } = req.params;

    const metadata = await metadataService.refreshMetadata(parseInt(id));

    res.json({
      success: true,
      metadata
    });
  } catch (error) {
    console.error('Error refreshing metadata:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Parse filename
 * POST /api/metadata/parse-filename
 */
export const parseFilename = async (req, res) => {
  try {
    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'filename is required' });
    }

    const parsed = filenameParser.parse(filename);

    res.json({
      success: true,
      parsed
    });
  } catch (error) {
    console.error('Error parsing filename:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Search TMDB
 * GET /api/metadata/search?query=...&type=movie|tv&year=...
 */
export const searchTMDB = async (req, res) => {
  try {
    const { query, type, year } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'query parameter is required' });
    }

    if (!tmdbService.isAvailable()) {
      return res.status(503).json({ error: 'TMDB service not configured' });
    }

    const result = await tmdbService.searchMedia(
      query,
      year ? parseInt(year) : null,
      type
    );

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Error searching TMDB:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get TMDB movie details
 * GET /api/metadata/tmdb/movie/:tmdbId
 */
export const getTMDBMovie = async (req, res) => {
  try {
    const { tmdbId } = req.params;

    if (!tmdbService.isAvailable()) {
      return res.status(503).json({ error: 'TMDB service not configured' });
    }

    const movie = await tmdbService.getMovieDetails(parseInt(tmdbId));

    res.json({
      success: true,
      movie
    });
  } catch (error) {
    console.error('Error getting TMDB movie:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get TMDB TV show details
 * GET /api/metadata/tmdb/tv/:tmdbId
 */
export const getTMDBTVShow = async (req, res) => {
  try {
    const { tmdbId } = req.params;

    if (!tmdbService.isAvailable()) {
      return res.status(503).json({ error: 'TMDB service not configured' });
    }

    const tvShow = await tmdbService.getTVShowDetails(parseInt(tmdbId));

    res.json({
      success: true,
      tvShow
    });
  } catch (error) {
    console.error('Error getting TMDB TV show:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update watch progress
 * POST /api/watch/progress
 */
export const updateWatchProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { mediaItemId, currentTime, duration } = req.body;

    if (!mediaItemId || currentTime === undefined || !duration) {
      return res.status(400).json({
        error: 'mediaItemId, currentTime, and duration are required'
      });
    }

    const progress = await watchHistoryService.updateProgress(
      userId,
      parseInt(mediaItemId),
      parseFloat(currentTime),
      parseFloat(duration)
    );

    res.json({
      success: true,
      progress
    });
  } catch (error) {
    console.error('Error updating watch progress:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get watch progress for a media item
 * GET /api/watch/progress/:mediaItemId
 */
export const getWatchProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { mediaItemId } = req.params;

    const progress = await watchHistoryService.getProgress(
      userId,
      parseInt(mediaItemId)
    );

    res.json({
      success: true,
      progress
    });
  } catch (error) {
    console.error('Error getting watch progress:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Mark as watched
 * POST /api/watch/mark-watched/:mediaItemId
 */
export const markAsWatched = async (req, res) => {
  try {
    const userId = req.user.id;
    const { mediaItemId } = req.params;

    await watchHistoryService.markAsWatched(userId, parseInt(mediaItemId));

    res.json({
      success: true,
      message: 'Marked as watched'
    });
  } catch (error) {
    console.error('Error marking as watched:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Mark as unwatched
 * DELETE /api/watch/mark-unwatched/:mediaItemId
 */
export const markAsUnwatched = async (req, res) => {
  try {
    const userId = req.user.id;
    const { mediaItemId } = req.params;

    await watchHistoryService.markAsUnwatched(userId, parseInt(mediaItemId));

    res.json({
      success: true,
      message: 'Marked as unwatched'
    });
  } catch (error) {
    console.error('Error marking as unwatched:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get continue watching list
 * GET /api/watch/continue-watching
 */
export const getContinueWatching = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    const items = await watchHistoryService.getContinueWatching(userId, limit);

    res.json({
      success: true,
      items
    });
  } catch (error) {
    console.error('Error getting continue watching:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get recently watched
 * GET /api/watch/recently-watched
 */
export const getRecentlyWatched = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;

    const items = await watchHistoryService.getRecentlyWatched(userId, limit);

    res.json({
      success: true,
      items
    });
  } catch (error) {
    console.error('Error getting recently watched:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get watch history
 * GET /api/watch/history
 */
export const getWatchHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
      completedOnly: req.query.completedOnly === 'true',
      incompleteOnly: req.query.incompleteOnly === 'true'
    };

    const items = await watchHistoryService.getUserHistory(userId, options);

    res.json({
      success: true,
      items
    });
  } catch (error) {
    console.error('Error getting watch history:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get watch statistics
 * GET /api/watch/stats
 */
export const getWatchStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await watchHistoryService.getUserStats(userId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting watch stats:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Reset watch progress
 * POST /api/watch/reset/:mediaItemId
 */
export const resetWatchProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { mediaItemId } = req.params;

    await watchHistoryService.resetProgress(userId, parseInt(mediaItemId));

    res.json({
      success: true,
      message: 'Progress reset'
    });
  } catch (error) {
    console.error('Error resetting progress:', error);
    res.status(500).json({ error: error.message });
  }
};
