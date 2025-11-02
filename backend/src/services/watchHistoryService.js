import database from '../config/database.js';

/**
 * Watch History Service
 * Tracks user viewing progress and watch history
 */
class WatchHistoryService {
  constructor() {
    this.progressUpdateInterval = 10000; // Update progress every 10 seconds
    this.continueWatchingThreshold = 0.95; // Consider "watched" if >95% complete
  }

  /**
   * Record or update watch progress
   * @param {number} userId - User ID
   * @param {number} mediaItemId - Media item ID
   * @param {number} currentTime - Current playback time in seconds
   * @param {number} duration - Total video duration in seconds
   * @returns {Promise<Object>} Watch history record
   */
  async updateProgress(userId, mediaItemId, currentTime, duration) {
    try {
      const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
      const completed = progress >= (this.continueWatchingThreshold * 100);

      // Check if record exists
      const existing = await database.get(`
        SELECT id, watch_count FROM watch_history
        WHERE user_id = ? AND media_item_id = ?
      `, [userId, mediaItemId]);

      if (existing) {
        // Update existing record
        await database.run(`
          UPDATE watch_history SET
            current_time = ?,
            duration = ?,
            progress = ?,
            completed = ?,
            last_watched = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [currentTime, duration, progress, completed ? 1 : 0, existing.id]);

        return {
          id: existing.id,
          userId,
          mediaItemId,
          currentTime,
          duration,
          progress,
          completed,
          watchCount: existing.watch_count
        };
      } else {
        // Create new record
        const result = await database.run(`
          INSERT INTO watch_history (
            user_id, media_item_id, current_time, duration,
            progress, completed, watch_count
          ) VALUES (?, ?, ?, ?, ?, ?, 1)
        `, [userId, mediaItemId, currentTime, duration, progress, completed ? 1 : 0]);

        return {
          id: result.lastID,
          userId,
          mediaItemId,
          currentTime,
          duration,
          progress,
          completed,
          watchCount: 1
        };
      }
    } catch (error) {
      console.error('Error updating watch progress:', error);
      throw error;
    }
  }

  /**
   * Mark media item as watched
   * @param {number} userId - User ID
   * @param {number} mediaItemId - Media item ID
   * @returns {Promise<void>}
   */
  async markAsWatched(userId, mediaItemId) {
    try {
      const mediaItem = await database.get(
        'SELECT duration FROM media_items WHERE id = ?',
        [mediaItemId]
      );

      const duration = mediaItem?.duration || 0;

      await this.updateProgress(userId, mediaItemId, duration, duration);
    } catch (error) {
      console.error('Error marking as watched:', error);
      throw error;
    }
  }

  /**
   * Mark media item as unwatched (remove from history)
   * @param {number} userId - User ID
   * @param {number} mediaItemId - Media item ID
   * @returns {Promise<void>}
   */
  async markAsUnwatched(userId, mediaItemId) {
    try {
      await database.run(`
        DELETE FROM watch_history
        WHERE user_id = ? AND media_item_id = ?
      `, [userId, mediaItemId]);
    } catch (error) {
      console.error('Error marking as unwatched:', error);
      throw error;
    }
  }

  /**
   * Get watch progress for a media item
   * @param {number} userId - User ID
   * @param {number} mediaItemId - Media item ID
   * @returns {Promise<Object|null>} Watch progress
   */
  async getProgress(userId, mediaItemId) {
    try {
      const record = await database.get(`
        SELECT
          wh.id,
          wh.current_time,
          wh.duration,
          wh.progress,
          wh.completed,
          wh.watch_count,
          wh.last_watched,
          mi.title,
          mi.poster_path
        FROM watch_history wh
        JOIN media_items mi ON wh.media_item_id = mi.id
        WHERE wh.user_id = ? AND wh.media_item_id = ?
      `, [userId, mediaItemId]);

      return record || null;
    } catch (error) {
      console.error('Error getting watch progress:', error);
      throw error;
    }
  }

  /**
   * Get all watch history for a user
   * @param {number} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Watch history records
   */
  async getUserHistory(userId, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        completedOnly = false,
        incompleteOnly = false,
        orderBy = 'last_watched',
        orderDir = 'DESC'
      } = options;

      let query = `
        SELECT
          wh.id,
          wh.media_item_id,
          wh.current_time,
          wh.duration,
          wh.progress,
          wh.completed,
          wh.watch_count,
          wh.last_watched,
          mi.title,
          mi.type,
          mi.poster_path,
          mi.backdrop_path,
          mi.release_date,
          mi.rating
        FROM watch_history wh
        JOIN media_items mi ON wh.media_item_id = mi.id
        WHERE wh.user_id = ?
      `;

      const params = [userId];

      if (completedOnly) {
        query += ' AND wh.completed = 1';
      } else if (incompleteOnly) {
        query += ' AND wh.completed = 0 AND wh.progress > 0';
      }

      query += ` ORDER BY wh.${orderBy} ${orderDir}`;
      query += ` LIMIT ? OFFSET ?`;

      params.push(limit, offset);

      const records = await database.all(query, params);

      return records;
    } catch (error) {
      console.error('Error getting user history:', error);
      throw error;
    }
  }

  /**
   * Get continue watching list (incomplete items)
   * @param {number} userId - User ID
   * @param {number} limit - Maximum number of items
   * @returns {Promise<Array>} Continue watching items
   */
  async getContinueWatching(userId, limit = 10) {
    try {
      return await this.getUserHistory(userId, {
        limit,
        incompleteOnly: true,
        orderBy: 'last_watched',
        orderDir: 'DESC'
      });
    } catch (error) {
      console.error('Error getting continue watching:', error);
      throw error;
    }
  }

  /**
   * Get recently watched items
   * @param {number} userId - User ID
   * @param {number} limit - Maximum number of items
   * @returns {Promise<Array>} Recently watched items
   */
  async getRecentlyWatched(userId, limit = 20) {
    try {
      return await this.getUserHistory(userId, {
        limit,
        orderBy: 'last_watched',
        orderDir: 'DESC'
      });
    } catch (error) {
      console.error('Error getting recently watched:', error);
      throw error;
    }
  }

  /**
   * Get watch statistics for a user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Watch statistics
   */
  async getUserStats(userId) {
    try {
      const stats = await database.get(`
        SELECT
          COUNT(*) as total_items,
          SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_items,
          SUM(CASE WHEN completed = 0 AND progress > 0 THEN 1 ELSE 0 END) as in_progress_items,
          SUM(watch_count) as total_watches,
          SUM(current_time) as total_watch_time,
          AVG(progress) as average_progress
        FROM watch_history
        WHERE user_id = ?
      `, [userId]);

      return {
        totalItems: stats.total_items || 0,
        completedItems: stats.completed_items || 0,
        inProgressItems: stats.in_progress_items || 0,
        totalWatches: stats.total_watches || 0,
        totalWatchTime: stats.total_watch_time || 0,
        totalWatchTimeFormatted: this.formatDuration(stats.total_watch_time || 0),
        averageProgress: stats.average_progress || 0
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  }

  /**
   * Increment watch count (when user starts watching again)
   * @param {number} userId - User ID
   * @param {number} mediaItemId - Media item ID
   * @returns {Promise<void>}
   */
  async incrementWatchCount(userId, mediaItemId) {
    try {
      await database.run(`
        UPDATE watch_history SET
          watch_count = watch_count + 1,
          last_watched = CURRENT_TIMESTAMP
        WHERE user_id = ? AND media_item_id = ?
      `, [userId, mediaItemId]);
    } catch (error) {
      console.error('Error incrementing watch count:', error);
      throw error;
    }
  }

  /**
   * Reset progress to beginning
   * @param {number} userId - User ID
   * @param {number} mediaItemId - Media item ID
   * @returns {Promise<void>}
   */
  async resetProgress(userId, mediaItemId) {
    try {
      await database.run(`
        UPDATE watch_history SET
          current_time = 0,
          progress = 0,
          completed = 0
        WHERE user_id = ? AND media_item_id = ?
      `, [userId, mediaItemId]);
    } catch (error) {
      console.error('Error resetting progress:', error);
      throw error;
    }
  }

  /**
   * Get watch progress for multiple items
   * @param {number} userId - User ID
   * @param {Array<number>} mediaItemIds - Array of media item IDs
   * @returns {Promise<Object>} Map of mediaItemId -> progress
   */
  async getBatchProgress(userId, mediaItemIds) {
    try {
      if (!mediaItemIds || mediaItemIds.length === 0) {
        return {};
      }

      const placeholders = mediaItemIds.map(() => '?').join(',');

      const records = await database.all(`
        SELECT media_item_id, current_time, duration, progress, completed
        FROM watch_history
        WHERE user_id = ? AND media_item_id IN (${placeholders})
      `, [userId, ...mediaItemIds]);

      const progressMap = {};
      records.forEach(record => {
        progressMap[record.media_item_id] = {
          currentTime: record.current_time,
          duration: record.duration,
          progress: record.progress,
          completed: record.completed === 1
        };
      });

      return progressMap;
    } catch (error) {
      console.error('Error getting batch progress:', error);
      throw error;
    }
  }

  /**
   * Clean old watch history records
   * @param {number} daysToKeep - Number of days to keep
   * @returns {Promise<number>} Number of deleted records
   */
  async cleanOldHistory(daysToKeep = 365) {
    try {
      const result = await database.run(`
        DELETE FROM watch_history
        WHERE last_watched < datetime('now', '-${daysToKeep} days')
        AND completed = 1
      `);

      console.log(`🧹 Cleaned ${result.changes} old watch history records`);
      return result.changes;
    } catch (error) {
      console.error('Error cleaning old history:', error);
      throw error;
    }
  }

  /**
   * Format duration in seconds to human readable string
   * @param {number} seconds - Duration in seconds
   * @returns {string} Formatted duration
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Get watching status for a media item
   * @param {number} userId - User ID
   * @param {number} mediaItemId - Media item ID
   * @returns {Promise<string>} Status: 'not_started', 'in_progress', 'completed'
   */
  async getWatchingStatus(userId, mediaItemId) {
    try {
      const progress = await this.getProgress(userId, mediaItemId);

      if (!progress) {
        return 'not_started';
      }

      if (progress.completed) {
        return 'completed';
      }

      if (progress.progress > 0) {
        return 'in_progress';
      }

      return 'not_started';
    } catch (error) {
      console.error('Error getting watching status:', error);
      throw error;
    }
  }
}

// Create singleton instance
const watchHistoryService = new WatchHistoryService();

export default watchHistoryService;
