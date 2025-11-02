import database from '../config/database.js';
import scannerService from '../services/scannerService.js';

export const getMovies = async (req, res) => {
  try {
    const movies = await database.all(
      `SELECT id, title, year, duration, file_path, poster_url, rating, added_at
       FROM media_items
       WHERE type = 'movie'
       ORDER BY added_at DESC`
    );

    res.json({
      count: movies.length,
      movies
    });
  } catch (error) {
    console.error('Error fetching movies:', error);
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
};

export const searchMedia = async (req, res) => {
  try {
    const { q, type, limit = 20 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const searchTerm = `%${q.trim()}%`;
    let query = `
      SELECT id, title, year, duration, file_path, poster_url, rating, type, overview, added_at
      FROM media_items
      WHERE (title LIKE ? OR overview LIKE ?)
    `;

    const params = [searchTerm, searchTerm];

    // Optional type filter (movie or episode)
    if (type && (type === 'movie' || type === 'episode')) {
      query += ` AND type = ?`;
      params.push(type);
    }

    query += ` ORDER BY
      CASE
        WHEN title LIKE ? THEN 1
        ELSE 2
      END,
      rating DESC,
      year DESC
      LIMIT ?`;

    params.push(`${q.trim()}%`); // Prefix match ranks higher
    params.push(parseInt(limit));

    const results = await database.all(query, params);

    res.json({
      query: q,
      count: results.length,
      results
    });
  } catch (error) {
    console.error('Error searching media:', error);
    res.status(500).json({ error: 'Failed to search media' });
  }
};

export const getMediaItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await database.get(
      'SELECT * FROM media_items WHERE id = ?',
      [id]
    );

    if (!item) {
      return res.status(404).json({ error: 'Media item not found' });
    }

    // Parse JSON fields
    if (item.genres) item.genres = JSON.parse(item.genres);
    if (item.cast) item.cast = JSON.parse(item.cast);

    res.json(item);
  } catch (error) {
    console.error('Error fetching media item:', error);
    res.status(500).json({ error: 'Failed to fetch media item' });
  }
};

export const scanLibrary = async (req, res) => {
  try {
    const { path } = req.body;

    if (!path) {
      return res.status(400).json({ error: 'Directory path is required' });
    }

    // Start scan asynchronously
    scannerService.scanDirectory(path, 'local', null)
      .catch(error => {
        console.error('Scan failed:', error);
      });

    res.json({
      message: 'Scan started',
      progress: scannerService.getProgress()
    });
  } catch (error) {
    console.error('Error starting scan:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getScanProgress = async (req, res) => {
  try {
    const progress = scannerService.getProgress();
    res.json(progress);
  } catch (error) {
    console.error('Error getting scan progress:', error);
    res.status(500).json({ error: 'Failed to get scan progress' });
  }
};

export const deleteMediaItem = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await database.run(
      'DELETE FROM media_items WHERE id = ?',
      [id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Media item not found' });
    }

    res.json({ message: 'Media item deleted successfully' });
  } catch (error) {
    console.error('Error deleting media item:', error);
    res.status(500).json({ error: 'Failed to delete media item' });
  }
};

export const getTVShows = async (req, res) => {
  try {
    const tvShows = await database.all(
      `SELECT
        ts.id,
        ts.title,
        m.poster_url,
        m.backdrop_url,
        m.overview,
        m.rating,
        ts.number_of_seasons,
        ts.number_of_episodes,
        ts.status,
        m.added_at
       FROM tv_shows ts
       JOIN media_items m ON ts.media_item_id = m.id
       ORDER BY m.added_at DESC`
    );

    res.json({
      count: tvShows.length,
      tvShows
    });
  } catch (error) {
    console.error('Error fetching TV shows:', error);
    res.status(500).json({ error: 'Failed to fetch TV shows' });
  }
};

export const getTVShowDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Get TV show details
    const tvShow = await database.get(
      `SELECT
        ts.*,
        m.poster_url,
        m.backdrop_url,
        m.overview,
        m.rating,
        m.genres
       FROM tv_shows ts
       JOIN media_items m ON ts.media_item_id = m.id
       WHERE ts.id = ?`,
      [id]
    );

    if (!tvShow) {
      return res.status(404).json({ error: 'TV show not found' });
    }

    // Get all episodes grouped by season
    const episodes = await database.all(
      `SELECT
        e.id,
        e.season_number,
        e.episode_number,
        e.title,
        e.overview,
        e.air_date,
        e.still_path,
        m.id as media_item_id,
        m.duration,
        m.file_path
       FROM episodes e
       JOIN media_items m ON e.media_item_id = m.id
       WHERE e.tv_show_id = ?
       ORDER BY e.season_number ASC, e.episode_number ASC`,
      [id]
    );

    // Group episodes by season
    const seasons = {};
    episodes.forEach(episode => {
      const seasonNum = episode.season_number;
      if (!seasons[seasonNum]) {
        seasons[seasonNum] = {
          seasonNumber: seasonNum,
          episodes: []
        };
      }
      seasons[seasonNum].episodes.push(episode);
    });

    // Convert to array and sort
    const seasonsArray = Object.values(seasons).sort((a, b) =>
      a.seasonNumber - b.seasonNumber
    );

    // Parse JSON fields
    if (tvShow.genres) tvShow.genres = JSON.parse(tvShow.genres);

    res.json({
      ...tvShow,
      seasons: seasonsArray,
      totalEpisodes: episodes.length
    });
  } catch (error) {
    console.error('Error fetching TV show details:', error);
    res.status(500).json({ error: 'Failed to fetch TV show details' });
  }
};

export const getNextEpisode = async (req, res) => {
  try {
    const { episodeId } = req.params;

    // Get current episode
    const currentEpisode = await database.get(
      `SELECT tv_show_id, season_number, episode_number
       FROM episodes
       WHERE media_item_id = ?`,
      [episodeId]
    );

    if (!currentEpisode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    // Try to get next episode in same season
    let nextEpisode = await database.get(
      `SELECT
        e.id,
        e.season_number,
        e.episode_number,
        e.title,
        m.id as media_item_id,
        m.file_path
       FROM episodes e
       JOIN media_items m ON e.media_item_id = m.id
       WHERE e.tv_show_id = ?
         AND e.season_number = ?
         AND e.episode_number > ?
       ORDER BY e.episode_number ASC
       LIMIT 1`,
      [currentEpisode.tv_show_id, currentEpisode.season_number, currentEpisode.episode_number]
    );

    // If no next episode in season, try first episode of next season
    if (!nextEpisode) {
      nextEpisode = await database.get(
        `SELECT
          e.id,
          e.season_number,
          e.episode_number,
          e.title,
          m.id as media_item_id,
          m.file_path
         FROM episodes e
         JOIN media_items m ON e.media_item_id = m.id
         WHERE e.tv_show_id = ?
           AND e.season_number > ?
         ORDER BY e.season_number ASC, e.episode_number ASC
         LIMIT 1`,
        [currentEpisode.tv_show_id, currentEpisode.season_number]
      );
    }

    if (!nextEpisode) {
      return res.status(404).json({ error: 'No next episode found' });
    }

    res.json(nextEpisode);
  } catch (error) {
    console.error('Error fetching next episode:', error);
    res.status(500).json({ error: 'Failed to fetch next episode' });
  }
};

export const getPreviousEpisode = async (req, res) => {
  try {
    const { episodeId } = req.params;

    // Get current episode
    const currentEpisode = await database.get(
      `SELECT tv_show_id, season_number, episode_number
       FROM episodes
       WHERE media_item_id = ?`,
      [episodeId]
    );

    if (!currentEpisode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    // Try to get previous episode in same season
    let previousEpisode = await database.get(
      `SELECT
        e.id,
        e.season_number,
        e.episode_number,
        e.title,
        m.id as media_item_id,
        m.file_path
       FROM episodes e
       JOIN media_items m ON e.media_item_id = m.id
       WHERE e.tv_show_id = ?
         AND e.season_number = ?
         AND e.episode_number < ?
       ORDER BY e.episode_number DESC
       LIMIT 1`,
      [currentEpisode.tv_show_id, currentEpisode.season_number, currentEpisode.episode_number]
    );

    // If no previous episode in season, try last episode of previous season
    if (!previousEpisode) {
      previousEpisode = await database.get(
        `SELECT
          e.id,
          e.season_number,
          e.episode_number,
          e.title,
          m.id as media_item_id,
          m.file_path
         FROM episodes e
         JOIN media_items m ON e.media_item_id = m.id
         WHERE e.tv_show_id = ?
           AND e.season_number < ?
         ORDER BY e.season_number DESC, e.episode_number DESC
         LIMIT 1`,
        [currentEpisode.tv_show_id, currentEpisode.season_number]
      );
    }

    if (!previousEpisode) {
      return res.status(404).json({ error: 'No previous episode found' });
    }

    res.json(previousEpisode);
  } catch (error) {
    console.error('Error fetching previous episode:', error);
    res.status(500).json({ error: 'Failed to fetch previous episode' });
  }
};
