import database from '../config/database.js';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';

// Get dashboard statistics
export const getDashboardStats = async (req, res) => {
  try {
    // Get total counts
    const totalUsers = await database.get('SELECT COUNT(*) as count FROM users');
    const totalMovies = await database.get('SELECT COUNT(*) as count FROM media_items WHERE type = "movie"');
    const totalTVShows = await database.get('SELECT COUNT(*) as count FROM media_items WHERE type = "tv_show"');
    const totalEpisodes = await database.get('SELECT COUNT(*) as count FROM media_items WHERE type = "episode"');

    // Get storage info
    const storageInfo = await database.get('SELECT SUM(file_size) as total_size FROM media_items');

    // Get recent activity
    const recentlyAdded = await database.all(
      `SELECT id, title, type, added_at
       FROM media_items
       ORDER BY added_at DESC
       LIMIT 10`
    );

    // Get most watched
    const mostWatched = await database.all(
      `SELECT m.id, m.title, m.type, m.poster_url, COUNT(w.id) as watch_count
       FROM media_items m
       LEFT JOIN watch_history w ON m.id = w.media_item_id
       GROUP BY m.id
       ORDER BY watch_count DESC
       LIMIT 10`
    );

    res.json({
      stats: {
        totalUsers: totalUsers.count,
        totalMovies: totalMovies.count,
        totalTVShows: totalTVShows.count,
        totalEpisodes: totalEpisodes.count,
        totalStorage: storageInfo.total_size || 0
      },
      recentlyAdded,
      mostWatched
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

// Get all users
export const getUsers = async (req, res) => {
  try {
    const users = await database.all(
      `SELECT id, username, is_admin, created_at FROM users ORDER BY created_at DESC`
    );

    // Get watch history count for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const watchCount = await database.get(
          'SELECT COUNT(*) as count FROM watch_history WHERE user_id = ?',
          [user.id]
        );
        return {
          ...user,
          watchCount: watchCount.count
        };
      })
    );

    res.json({ users: usersWithStats });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Delete a user
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Don't allow deleting yourself
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Delete user and cascade to watch history
    await database.run('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

// Toggle admin status
export const toggleAdminStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    // Don't allow changing your own admin status
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot change your own admin status' });
    }

    // Get current status
    const user = await database.get('SELECT is_admin FROM users WHERE id = ?', [userId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Toggle status
    const newStatus = user.is_admin ? 0 : 1;
    await database.run('UPDATE users SET is_admin = ? WHERE id = ?', [newStatus, userId]);

    res.json({
      message: `User ${newStatus ? 'promoted to' : 'removed from'} admin`,
      isAdmin: newStatus === 1
    });
  } catch (error) {
    console.error('Error toggling admin status:', error);
    res.status(500).json({ error: 'Failed to toggle admin status' });
  }
};

// Get library statistics
export const getLibraryStats = async (req, res) => {
  try {
    // Get media by type
    const movieCount = await database.get('SELECT COUNT(*) as count FROM media_items WHERE type = "movie"');
    const tvShowCount = await database.get('SELECT COUNT(*) as count FROM media_items WHERE type = "tv_show"');
    const episodeCount = await database.get('SELECT COUNT(*) as count FROM media_items WHERE type = "episode"');

    // Get media with/without metadata
    const withMetadata = await database.get(
      'SELECT COUNT(*) as count FROM media_items WHERE tmdb_id IS NOT NULL'
    );
    const withoutMetadata = await database.get(
      'SELECT COUNT(*) as count FROM media_items WHERE tmdb_id IS NULL AND type != "episode"'
    );

    // Get recent scans or errors
    const mediaWithoutFiles = await database.all(
      `SELECT id, title, file_path FROM media_items WHERE type != "tv_show" LIMIT 50`
    );

    // Check which files don't exist
    const missingFiles = [];
    for (const media of mediaWithoutFiles) {
      if (!existsSync(media.file_path)) {
        missingFiles.push({
          id: media.id,
          title: media.title,
          file_path: media.file_path
        });
      }
    }

    res.json({
      mediaByType: {
        movies: movieCount.count,
        tvShows: tvShowCount.count,
        episodes: episodeCount.count
      },
      metadata: {
        withMetadata: withMetadata.count,
        withoutMetadata: withoutMetadata.count
      },
      missingFiles: missingFiles.slice(0, 10) // Only send first 10
    });
  } catch (error) {
    console.error('Error fetching library stats:', error);
    res.status(500).json({ error: 'Failed to fetch library stats' });
  }
};

// Delete media item and its file
export const deleteMediaItem = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { deleteFile } = req.body; // Whether to delete the physical file

    // Get media info
    const media = await database.get('SELECT * FROM media_items WHERE id = ?', [mediaId]);

    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    // Delete from database (cascades to watch history, subtitles, etc.)
    await database.run('DELETE FROM media_items WHERE id = ?', [mediaId]);

    // Delete physical file if requested and it exists
    if (deleteFile && media.file_path && existsSync(media.file_path)) {
      try {
        await unlink(media.file_path);
        console.log(`Deleted file: ${media.file_path}`);
      } catch (fileError) {
        console.error('Error deleting file:', fileError);
        // Continue even if file deletion fails
      }
    }

    res.json({
      message: 'Media item deleted successfully',
      deletedFile: deleteFile
    });
  } catch (error) {
    console.error('Error deleting media item:', error);
    res.status(500).json({ error: 'Failed to delete media item' });
  }
};

// Get all media items with pagination
export const getAllMedia = async (req, res) => {
  try {
    const { page = 1, limit = 50, type, search } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM media_items';
    let countQuery = 'SELECT COUNT(*) as total FROM media_items';
    const params = [];
    const countParams = [];

    // Add filters
    const conditions = [];

    if (type && type !== 'all') {
      conditions.push('type = ?');
      params.push(type);
      countParams.push(type);
    }

    if (search) {
      conditions.push('title LIKE ?');
      params.push(`%${search}%`);
      countParams.push(`%${search}%`);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ' ORDER BY added_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [media, totalResult] = await Promise.all([
      database.all(query, params),
      database.get(countQuery, countParams)
    ]);

    res.json({
      media,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalResult.total,
        totalPages: Math.ceil(totalResult.total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
};
