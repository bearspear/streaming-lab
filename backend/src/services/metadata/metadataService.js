import filenameParser from './filenameParser.js';
import tmdbService from './tmdbService.js';
import database from '../../config/database.js';

/**
 * Metadata Service
 * Orchestrates filename parsing, TMDB lookups, and database enrichment
 */
class MetadataService {
  constructor() {
    this.minConfidence = 60; // Minimum confidence score for auto-matching
  }

  /**
   * Process a media file and fetch metadata
   * @param {string} filePath - Path to media file
   * @param {number} mediaItemId - Database ID of media item
   * @returns {Promise<Object>} Enriched metadata
   */
  async processMediaFile(filePath, mediaItemId = null) {
    try {
      // Step 1: Parse filename
      const parsed = filenameParser.parse(filePath);
      console.log(`📝 Parsed: "${parsed.title}" (${parsed.year || 'no year'}) - ${parsed.type}`);

      // Step 2: Search TMDB
      let metadata = null;
      let tmdbId = null;
      let matchConfidence = parsed.confidence;

      if (tmdbService.isAvailable()) {
        if (parsed.type === 'movie') {
          metadata = await this.fetchMovieMetadata(parsed);
          tmdbId = metadata?.tmdb_id;
        } else if (parsed.type === 'episode') {
          metadata = await this.fetchEpisodeMetadata(parsed);
          tmdbId = metadata?.show_tmdb_id;
        }

        if (metadata) {
          console.log(`✅ Found: "${metadata.title}"`);
        } else {
          console.log(`⚠️  No TMDB match found`);
        }
      } else {
        console.log(`⚠️  TMDB service not available - skipping metadata fetch`);
      }

      // Step 3: Combine parsed data with TMDB metadata
      const enrichedData = {
        // Parsed information
        parsed_title: parsed.title,
        parsed_year: parsed.year,
        quality: parsed.quality,
        source: parsed.source,
        codec: parsed.codec,

        // TMDB metadata
        ...(metadata || {}),

        // Match information
        match_confidence: matchConfidence,
        tmdb_id: tmdbId,
        metadata_fetched_at: new Date().toISOString()
      };

      // Step 4: Update database if mediaItemId provided
      if (mediaItemId && metadata) {
        await this.updateMediaItem(mediaItemId, enrichedData, parsed.type);
      }

      return enrichedData;
    } catch (error) {
      console.error('Error processing media file:', error);
      throw error;
    }
  }

  /**
   * Fetch movie metadata from TMDB
   * @param {Object} parsed - Parsed filename data
   * @returns {Promise<Object|null>} Movie metadata
   */
  async fetchMovieMetadata(parsed) {
    try {
      // Search for movie
      const searchResult = await tmdbService.searchMovie(parsed.title, parsed.year);

      if (!searchResult) {
        return null;
      }

      // Get full details
      const details = await tmdbService.getMovieDetails(searchResult.id);

      return details;
    } catch (error) {
      console.error('Error fetching movie metadata:', error.message);
      return null;
    }
  }

  /**
   * Fetch TV show and episode metadata from TMDB
   * @param {Object} parsed - Parsed filename data
   * @returns {Promise<Object|null>} Episode metadata with show info
   */
  async fetchEpisodeMetadata(parsed) {
    try {
      // Search for TV show
      const searchResult = await tmdbService.searchTVShow(parsed.title, parsed.year);

      if (!searchResult) {
        return null;
      }

      // Get show details
      const showDetails = await tmdbService.getTVShowDetails(searchResult.id);

      // If we have season/episode info, get episode details
      let episodeDetails = null;
      if (parsed.season && parsed.episode) {
        try {
          episodeDetails = await tmdbService.getEpisodeDetails(
            searchResult.id,
            parsed.season,
            parsed.episode
          );
        } catch (error) {
          console.log(`⚠️  Episode ${parsed.season}x${parsed.episode} not found`);
        }
      }

      return {
        // Show information
        show_tmdb_id: showDetails.tmdb_id,
        show_title: showDetails.title,
        show_overview: showDetails.overview,
        show_poster: showDetails.poster_path,
        show_backdrop: showDetails.backdrop_path,
        show_genres: showDetails.genres,
        show_first_air_date: showDetails.first_air_date,
        show_status: showDetails.status,

        // Episode information
        ...(episodeDetails && {
          episode_tmdb_id: episodeDetails.tmdb_id,
          episode_title: episodeDetails.title,
          episode_overview: episodeDetails.overview,
          episode_still: episodeDetails.still_path,
          episode_air_date: episodeDetails.air_date,
          episode_runtime: episodeDetails.runtime
        }),

        // Combined title for display
        title: episodeDetails
          ? `${showDetails.title} - S${String(parsed.season).padStart(2, '0')}E${String(parsed.episode).padStart(2, '0')} - ${episodeDetails.title}`
          : showDetails.title
      };
    } catch (error) {
      console.error('Error fetching episode metadata:', error.message);
      return null;
    }
  }

  /**
   * Update media item in database with metadata
   * @param {number} mediaItemId - Media item ID
   * @param {Object} metadata - Enriched metadata
   * @param {string} type - 'movie' or 'episode'
   * @returns {Promise<void>}
   */
  async updateMediaItem(mediaItemId, metadata, type) {
    try {
      if (type === 'movie') {
        await database.run(`
          UPDATE media_items SET
            title = COALESCE(?, title),
            overview = ?,
            release_date = ?,
            runtime = ?,
            genres = ?,
            poster_path = ?,
            backdrop_path = ?,
            rating = ?,
            tmdb_id = ?,
            quality = COALESCE(?, quality)
          WHERE id = ?
        `, [
          metadata.title,
          metadata.overview,
          metadata.release_date,
          metadata.runtime,
          metadata.genres,
          metadata.poster_path,
          metadata.backdrop_path,
          metadata.vote_average,
          metadata.tmdb_id,
          metadata.quality,
          mediaItemId
        ]);
      } else if (type === 'episode') {
        // Update or create TV show entry
        if (metadata.show_tmdb_id) {
          await this.upsertTVShow(metadata);

          // Update episode information
          await this.upsertEpisode(mediaItemId, metadata);
        }

        // Update media item
        await database.run(`
          UPDATE media_items SET
            title = COALESCE(?, title),
            overview = ?,
            poster_path = ?,
            backdrop_path = ?,
            tmdb_id = ?,
            quality = COALESCE(?, quality)
          WHERE id = ?
        `, [
          metadata.title,
          metadata.episode_overview || metadata.show_overview,
          metadata.episode_still || metadata.show_poster,
          metadata.show_backdrop,
          metadata.show_tmdb_id,
          metadata.quality,
          mediaItemId
        ]);
      }

      console.log(`📊 Updated media item ${mediaItemId} with metadata`);
    } catch (error) {
      console.error('Error updating media item:', error);
      throw error;
    }
  }

  /**
   * Insert or update TV show in database
   * @param {Object} metadata - Show metadata
   * @returns {Promise<number>} TV show ID
   */
  async upsertTVShow(metadata) {
    try {
      // Check if show exists
      const existing = await database.get(
        'SELECT id FROM tv_shows WHERE tmdb_id = ?',
        [metadata.show_tmdb_id]
      );

      if (existing) {
        // Update existing
        await database.run(`
          UPDATE tv_shows SET
            title = ?,
            overview = ?,
            first_air_date = ?,
            poster_path = ?,
            backdrop_path = ?,
            genres = ?,
            status = ?
          WHERE tmdb_id = ?
        `, [
          metadata.show_title,
          metadata.show_overview,
          metadata.show_first_air_date,
          metadata.show_poster,
          metadata.show_backdrop,
          metadata.show_genres,
          metadata.show_status,
          metadata.show_tmdb_id
        ]);

        return existing.id;
      } else {
        // Insert new
        const result = await database.run(`
          INSERT INTO tv_shows (
            tmdb_id, title, overview, first_air_date,
            poster_path, backdrop_path, genres, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          metadata.show_tmdb_id,
          metadata.show_title,
          metadata.show_overview,
          metadata.show_first_air_date,
          metadata.show_poster,
          metadata.show_backdrop,
          metadata.show_genres,
          metadata.show_status
        ]);

        return result.lastID;
      }
    } catch (error) {
      console.error('Error upserting TV show:', error);
      throw error;
    }
  }

  /**
   * Insert or update episode in database
   * @param {number} mediaItemId - Media item ID
   * @param {Object} metadata - Episode metadata
   * @returns {Promise<void>}
   */
  async upsertEpisode(mediaItemId, metadata) {
    try {
      // Get TV show ID
      const show = await database.get(
        'SELECT id FROM tv_shows WHERE tmdb_id = ?',
        [metadata.show_tmdb_id]
      );

      if (!show) {
        console.error('TV show not found for episode');
        return;
      }

      // Check if episode exists
      const existing = await database.get(
        'SELECT id FROM episodes WHERE media_item_id = ?',
        [mediaItemId]
      );

      if (existing) {
        // Update existing
        await database.run(`
          UPDATE episodes SET
            tv_show_id = ?,
            season_number = ?,
            episode_number = ?,
            title = ?,
            overview = ?,
            air_date = ?,
            still_path = ?
          WHERE media_item_id = ?
        `, [
          show.id,
          metadata.season_number,
          metadata.episode_number,
          metadata.episode_title,
          metadata.episode_overview,
          metadata.episode_air_date,
          metadata.episode_still,
          mediaItemId
        ]);
      } else {
        // Insert new
        await database.run(`
          INSERT INTO episodes (
            tv_show_id, media_item_id, season_number, episode_number,
            title, overview, air_date, still_path
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          show.id,
          mediaItemId,
          metadata.season_number,
          metadata.episode_number,
          metadata.episode_title,
          metadata.episode_overview,
          metadata.episode_air_date,
          metadata.episode_still
        ]);
      }
    } catch (error) {
      console.error('Error upserting episode:', error);
      throw error;
    }
  }

  /**
   * Batch process multiple media files
   * @param {Array<Object>} mediaItems - Array of {id, file_path}
   * @param {Function} progressCallback - Optional progress callback
   * @returns {Promise<Object>} Processing results
   */
  async batchProcess(mediaItems, progressCallback = null) {
    const results = {
      total: mediaItems.length,
      processed: 0,
      matched: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < mediaItems.length; i++) {
      const item = mediaItems[i];

      try {
        const metadata = await this.processMediaFile(item.file_path, item.id);

        if (metadata.tmdb_id) {
          results.matched++;
        }

        results.processed++;

        if (progressCallback) {
          progressCallback({
            current: i + 1,
            total: mediaItems.length,
            item,
            metadata
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          item,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Manually match media item to TMDB ID
   * @param {number} mediaItemId - Media item ID
   * @param {number} tmdbId - TMDB ID
   * @param {string} type - 'movie' or 'tv'
   * @returns {Promise<Object>} Updated metadata
   */
  async manualMatch(mediaItemId, tmdbId, type) {
    try {
      let metadata;

      if (type === 'movie') {
        metadata = await tmdbService.getMovieDetails(tmdbId);
      } else if (type === 'tv') {
        metadata = await tmdbService.getTVShowDetails(tmdbId);
      } else {
        throw new Error('Invalid type: must be "movie" or "tv"');
      }

      await this.updateMediaItem(mediaItemId, metadata, type);

      return metadata;
    } catch (error) {
      console.error('Error in manual match:', error);
      throw error;
    }
  }

  /**
   * Refresh metadata for a media item
   * @param {number} mediaItemId - Media item ID
   * @returns {Promise<Object>} Updated metadata
   */
  async refreshMetadata(mediaItemId) {
    try {
      // Get current media item
      const mediaItem = await database.get(
        'SELECT * FROM media_items WHERE id = ?',
        [mediaItemId]
      );

      if (!mediaItem) {
        throw new Error('Media item not found');
      }

      // Reprocess
      return await this.processMediaFile(mediaItem.file_path, mediaItemId);
    } catch (error) {
      console.error('Error refreshing metadata:', error);
      throw error;
    }
  }
}

// Create singleton instance
const metadataService = new MetadataService();

export default metadataService;
