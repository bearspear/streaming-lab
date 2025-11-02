import { MovieDb } from 'moviedb-promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * TMDB API Service
 * Fetches movie and TV show metadata from The Movie Database
 */
class TMDBService {
  constructor() {
    this.apiKey = process.env.TMDB_API_KEY;
    this.language = process.env.TMDB_LANGUAGE || 'en-US';
    this.autoFetch = process.env.TMDB_AUTO_FETCH === 'true';

    if (!this.apiKey || this.apiKey === 'your-tmdb-api-key-here') {
      console.warn('⚠️  TMDB API key not configured. Metadata fetching will be disabled.');
      this.client = null;
    } else {
      this.client = new MovieDb(this.apiKey);
      console.log('✅ TMDB API client initialized');
    }
  }

  /**
   * Check if TMDB service is available
   * @returns {boolean}
   */
  isAvailable() {
    return this.client !== null;
  }

  /**
   * Search for a movie by title and year
   * @param {string} title - Movie title
   * @param {number} year - Release year (optional)
   * @returns {Promise<Object|null>} Movie data or null
   */
  async searchMovie(title, year = null) {
    if (!this.isAvailable()) {
      throw new Error('TMDB API key not configured');
    }

    try {
      const searchParams = {
        query: title,
        language: this.language,
        include_adult: false
      };

      if (year) {
        searchParams.year = year;
      }

      const response = await this.client.searchMovie(searchParams);

      if (response.results && response.results.length > 0) {
        // Return the first (most relevant) result
        return response.results[0];
      }

      return null;
    } catch (error) {
      console.error('Error searching movie:', error.message);
      throw error;
    }
  }

  /**
   * Get detailed movie information by TMDB ID
   * @param {number} tmdbId - TMDB movie ID
   * @returns {Promise<Object>} Detailed movie data
   */
  async getMovieDetails(tmdbId) {
    if (!this.isAvailable()) {
      throw new Error('TMDB API key not configured');
    }

    try {
      const movie = await this.client.movieInfo({
        id: tmdbId,
        language: this.language,
        append_to_response: 'credits,videos,release_dates'
      });

      return this.formatMovieData(movie);
    } catch (error) {
      console.error('Error fetching movie details:', error.message);
      throw error;
    }
  }

  /**
   * Search for a TV show by title and year
   * @param {string} title - TV show title
   * @param {number} year - First air year (optional)
   * @returns {Promise<Object|null>} TV show data or null
   */
  async searchTVShow(title, year = null) {
    if (!this.isAvailable()) {
      throw new Error('TMDB API key not configured');
    }

    try {
      const searchParams = {
        query: title,
        language: this.language,
        include_adult: false
      };

      if (year) {
        searchParams.first_air_date_year = year;
      }

      const response = await this.client.searchTv(searchParams);

      if (response.results && response.results.length > 0) {
        return response.results[0];
      }

      return null;
    } catch (error) {
      console.error('Error searching TV show:', error.message);
      throw error;
    }
  }

  /**
   * Get detailed TV show information by TMDB ID
   * @param {number} tmdbId - TMDB TV show ID
   * @returns {Promise<Object>} Detailed TV show data
   */
  async getTVShowDetails(tmdbId) {
    if (!this.isAvailable()) {
      throw new Error('TMDB API key not configured');
    }

    try {
      const tvShow = await this.client.tvInfo({
        id: tmdbId,
        language: this.language,
        append_to_response: 'credits,videos,content_ratings'
      });

      return this.formatTVShowData(tvShow);
    } catch (error) {
      console.error('Error fetching TV show details:', error.message);
      throw error;
    }
  }

  /**
   * Get TV show episode details
   * @param {number} tvShowId - TMDB TV show ID
   * @param {number} seasonNumber - Season number
   * @param {number} episodeNumber - Episode number
   * @returns {Promise<Object>} Episode data
   */
  async getEpisodeDetails(tvShowId, seasonNumber, episodeNumber) {
    if (!this.isAvailable()) {
      throw new Error('TMDB API key not configured');
    }

    try {
      const episode = await this.client.episodeInfo({
        id: tvShowId,
        season_number: seasonNumber,
        episode_number: episodeNumber,
        language: this.language
      });

      return this.formatEpisodeData(episode);
    } catch (error) {
      console.error('Error fetching episode details:', error.message);
      throw error;
    }
  }

  /**
   * Get TV show season details
   * @param {number} tvShowId - TMDB TV show ID
   * @param {number} seasonNumber - Season number
   * @returns {Promise<Object>} Season data with all episodes
   */
  async getSeasonDetails(tvShowId, seasonNumber) {
    if (!this.isAvailable()) {
      throw new Error('TMDB API key not configured');
    }

    try {
      const season = await this.client.seasonInfo({
        id: tvShowId,
        season_number: seasonNumber,
        language: this.language
      });

      return season;
    } catch (error) {
      console.error('Error fetching season details:', error.message);
      throw error;
    }
  }

  /**
   * Format movie data for database storage
   * @param {Object} movie - Raw TMDB movie data
   * @returns {Object} Formatted movie data
   */
  formatMovieData(movie) {
    return {
      tmdb_id: movie.id,
      title: movie.title,
      original_title: movie.original_title,
      overview: movie.overview,
      release_date: movie.release_date,
      runtime: movie.runtime,
      genres: movie.genres?.map(g => g.name).join(', '),
      poster_path: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
      backdrop_path: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null,
      vote_average: movie.vote_average,
      vote_count: movie.vote_count,
      popularity: movie.popularity,
      tagline: movie.tagline,
      status: movie.status,
      budget: movie.budget,
      revenue: movie.revenue,
      imdb_id: movie.imdb_id,
      // Cast and crew
      cast: movie.credits?.cast?.slice(0, 10).map(c => c.name).join(', '),
      director: movie.credits?.crew?.find(c => c.job === 'Director')?.name,
      // Video trailer
      trailer: this.extractTrailerKey(movie.videos),
      // Certification
      certification: this.extractCertification(movie.release_dates),
      // Original data
      metadata: movie
    };
  }

  /**
   * Format TV show data for database storage
   * @param {Object} tvShow - Raw TMDB TV show data
   * @returns {Object} Formatted TV show data
   */
  formatTVShowData(tvShow) {
    return {
      tmdb_id: tvShow.id,
      title: tvShow.name,
      original_title: tvShow.original_name,
      overview: tvShow.overview,
      first_air_date: tvShow.first_air_date,
      last_air_date: tvShow.last_air_date,
      number_of_seasons: tvShow.number_of_seasons,
      number_of_episodes: tvShow.number_of_episodes,
      episode_runtime: tvShow.episode_run_time?.[0] || null,
      genres: tvShow.genres?.map(g => g.name).join(', '),
      poster_path: tvShow.poster_path ? `https://image.tmdb.org/t/p/w500${tvShow.poster_path}` : null,
      backdrop_path: tvShow.backdrop_path ? `https://image.tmdb.org/t/p/original${tvShow.backdrop_path}` : null,
      vote_average: tvShow.vote_average,
      vote_count: tvShow.vote_count,
      popularity: tvShow.popularity,
      status: tvShow.status,
      type: tvShow.type,
      // Cast and crew
      cast: tvShow.credits?.cast?.slice(0, 10).map(c => c.name).join(', '),
      created_by: tvShow.created_by?.map(c => c.name).join(', '),
      // Networks
      networks: tvShow.networks?.map(n => n.name).join(', '),
      // Video trailer
      trailer: this.extractTrailerKey(tvShow.videos),
      // Content rating
      content_rating: this.extractTVRating(tvShow.content_ratings),
      // Original data
      metadata: tvShow
    };
  }

  /**
   * Format episode data
   * @param {Object} episode - Raw TMDB episode data
   * @returns {Object} Formatted episode data
   */
  formatEpisodeData(episode) {
    return {
      tmdb_id: episode.id,
      episode_number: episode.episode_number,
      season_number: episode.season_number,
      title: episode.name,
      overview: episode.overview,
      air_date: episode.air_date,
      runtime: episode.runtime,
      still_path: episode.still_path ? `https://image.tmdb.org/t/p/w500${episode.still_path}` : null,
      vote_average: episode.vote_average,
      vote_count: episode.vote_count,
      // Guest stars
      guest_stars: episode.guest_stars?.map(g => g.name).join(', '),
      // Crew
      director: episode.crew?.find(c => c.job === 'Director')?.name,
      writer: episode.crew?.find(c => c.job === 'Writer')?.name,
      metadata: episode
    };
  }

  /**
   * Extract YouTube trailer key from videos
   * @param {Object} videos - TMDB videos object
   * @returns {string|null} YouTube video key
   */
  extractTrailerKey(videos) {
    if (!videos || !videos.results) return null;

    const trailer = videos.results.find(
      v => v.type === 'Trailer' && v.site === 'YouTube'
    );

    return trailer ? trailer.key : null;
  }

  /**
   * Extract movie certification (rating)
   * @param {Object} releaseDates - TMDB release_dates object
   * @returns {string|null} Certification (e.g., "PG-13")
   */
  extractCertification(releaseDates) {
    if (!releaseDates || !releaseDates.results) return null;

    // Look for US certification first
    const usRelease = releaseDates.results.find(r => r.iso_3166_1 === 'US');
    if (usRelease && usRelease.release_dates) {
      const certified = usRelease.release_dates.find(rd => rd.certification);
      if (certified) return certified.certification;
    }

    return null;
  }

  /**
   * Extract TV show content rating
   * @param {Object} contentRatings - TMDB content_ratings object
   * @returns {string|null} Content rating
   */
  extractTVRating(contentRatings) {
    if (!contentRatings || !contentRatings.results) return null;

    // Look for US rating first
    const usRating = contentRatings.results.find(r => r.iso_3166_1 === 'US');
    return usRating ? usRating.rating : null;
  }

  /**
   * Search for media (auto-detect movie or TV)
   * @param {string} title - Media title
   * @param {number} year - Year (optional)
   * @param {string} type - 'movie' or 'tv' (optional, auto-detect if not provided)
   * @returns {Promise<Object>} Search results with type
   */
  async searchMedia(title, year = null, type = null) {
    if (!this.isAvailable()) {
      throw new Error('TMDB API key not configured');
    }

    try {
      if (type === 'movie') {
        const result = await this.searchMovie(title, year);
        return result ? { type: 'movie', data: result } : null;
      }

      if (type === 'tv') {
        const result = await this.searchTVShow(title, year);
        return result ? { type: 'tv', data: result } : null;
      }

      // Auto-detect: try both
      const [movieResult, tvResult] = await Promise.all([
        this.searchMovie(title, year).catch(() => null),
        this.searchTVShow(title, year).catch(() => null)
      ]);

      // Return the one with higher popularity
      if (movieResult && tvResult) {
        return movieResult.popularity > tvResult.popularity
          ? { type: 'movie', data: movieResult }
          : { type: 'tv', data: tvResult };
      }

      if (movieResult) return { type: 'movie', data: movieResult };
      if (tvResult) return { type: 'tv', data: tvResult };

      return null;
    } catch (error) {
      console.error('Error searching media:', error.message);
      throw error;
    }
  }

  /**
   * Get popular movies
   * @param {number} page - Page number
   * @returns {Promise<Array>} Array of popular movies
   */
  async getPopularMovies(page = 1) {
    if (!this.isAvailable()) {
      throw new Error('TMDB API key not configured');
    }

    try {
      const response = await this.client.moviePopular({
        language: this.language,
        page
      });

      return response.results;
    } catch (error) {
      console.error('Error fetching popular movies:', error.message);
      throw error;
    }
  }

  /**
   * Get popular TV shows
   * @param {number} page - Page number
   * @returns {Promise<Array>} Array of popular TV shows
   */
  async getPopularTVShows(page = 1) {
    if (!this.isAvailable()) {
      throw new Error('TMDB API key not configured');
    }

    try {
      const response = await this.client.tvPopular({
        language: this.language,
        page
      });

      return response.results;
    } catch (error) {
      console.error('Error fetching popular TV shows:', error.message);
      throw error;
    }
  }
}

// Create singleton instance
const tmdbService = new TMDBService();

export default tmdbService;
