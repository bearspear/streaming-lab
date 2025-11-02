import ptt from 'parse-torrent-title';
import path from 'path';

/**
 * Filename Parser Service
 * Extracts movie and TV show information from filenames
 */
class FilenameParser {
  constructor() {
    // Video quality indicators
    this.qualityPatterns = {
      '4K': /4K|2160p/i,
      '1080p': /1080p/i,
      '720p': /720p/i,
      '480p': /480p/i,
      '360p': /360p/i
    };

    // Source/release type indicators
    this.sourcePatterns = {
      'BluRay': /bluray|blu-ray|bdrip|bd/i,
      'WEB-DL': /web-dl|webdl/i,
      'WEBRip': /webrip/i,
      'DVDRip': /dvdrip/i,
      'HDTV': /hdtv/i,
      'CAM': /cam|camrip/i,
      'TS': /ts|telesync/i
    };

    // Codec patterns
    this.codecPatterns = {
      'x264': /x264|h\.264/i,
      'x265': /x265|h\.265|hevc/i,
      'XVID': /xvid/i
    };
  }

  /**
   * Parse filename and extract media information
   * @param {string} filename - Full file path or filename
   * @returns {Object} Parsed information
   */
  parse(filename) {
    try {
      // Get just the filename without path
      const basename = path.basename(filename, path.extname(filename));

      // Use parse-torrent-title for initial parsing
      const parsed = ptt.parse(basename);

      // Clean and enhance the parsed data
      const result = {
        // Basic information
        title: this.cleanTitle(parsed.title || basename),
        year: parsed.year || null,

        // Type detection
        type: this.detectType(parsed),

        // TV show specific
        season: parsed.season || null,
        episode: parsed.episode || null,
        episodes: parsed.episodes || null,

        // Quality information
        resolution: parsed.resolution || this.detectQuality(basename),
        quality: this.detectQuality(basename),
        source: this.detectSource(basename),
        codec: this.detectCodec(basename),

        // Audio
        audio: parsed.audio || null,

        // Release information
        group: parsed.group || null,

        // Original filename
        original: basename,

        // Parsing metadata
        confidence: this.calculateConfidence(parsed, basename),
        parsedWith: 'parse-torrent-title'
      };

      // Additional TV show parsing
      if (result.type === 'episode') {
        result.episodeTitle = parsed.episodeName || null;
        result.showTitle = result.title;
      }

      return result;
    } catch (error) {
      console.error('Error parsing filename:', error);
      return this.fallbackParse(filename);
    }
  }

  /**
   * Detect if this is a movie or TV episode
   * @param {Object} parsed - Parsed data from parse-torrent-title
   * @returns {string} 'movie' or 'episode'
   */
  detectType(parsed) {
    if (parsed.season || parsed.episode) {
      return 'episode';
    }
    return 'movie';
  }

  /**
   * Clean and normalize title
   * @param {string} title - Raw title
   * @returns {string} Cleaned title
   */
  cleanTitle(title) {
    return title
      .replace(/\./g, ' ')  // Replace dots with spaces
      .replace(/_/g, ' ')   // Replace underscores with spaces
      .replace(/\s+/g, ' ') // Remove multiple spaces
      .trim();
  }

  /**
   * Detect video quality from filename
   * @param {string} filename - Filename to analyze
   * @returns {string|null} Quality indicator
   */
  detectQuality(filename) {
    for (const [quality, pattern] of Object.entries(this.qualityPatterns)) {
      if (pattern.test(filename)) {
        return quality;
      }
    }
    return null;
  }

  /**
   * Detect source/release type
   * @param {string} filename - Filename to analyze
   * @returns {string|null} Source indicator
   */
  detectSource(filename) {
    for (const [source, pattern] of Object.entries(this.sourcePatterns)) {
      if (pattern.test(filename)) {
        return source;
      }
    }
    return null;
  }

  /**
   * Detect video codec
   * @param {string} filename - Filename to analyze
   * @returns {string|null} Codec indicator
   */
  detectCodec(filename) {
    for (const [codec, pattern] of Object.entries(this.codecPatterns)) {
      if (pattern.test(filename)) {
        return codec;
      }
    }
    return null;
  }

  /**
   * Calculate parsing confidence
   * @param {Object} parsed - Parsed data
   * @param {string} filename - Original filename
   * @returns {number} Confidence score 0-100
   */
  calculateConfidence(parsed, filename) {
    let confidence = 0;

    // Has title
    if (parsed.title) confidence += 40;

    // Has year
    if (parsed.year) confidence += 20;

    // TV show has season/episode
    if (parsed.season || parsed.episode) confidence += 15;

    // Has quality information
    if (parsed.resolution || this.detectQuality(filename)) confidence += 10;

    // Has release group
    if (parsed.group) confidence += 10;

    // Has source information
    if (this.detectSource(filename)) confidence += 5;

    return Math.min(confidence, 100);
  }

  /**
   * Fallback parser for when parse-torrent-title fails
   * @param {string} filename - Filename to parse
   * @returns {Object} Basic parsed information
   */
  fallbackParse(filename) {
    const basename = path.basename(filename, path.extname(filename));

    // Try to extract year
    const yearMatch = basename.match(/\(?\d{4}\)?/);
    const year = yearMatch ? parseInt(yearMatch[0].replace(/[()]/g, '')) : null;

    // Try to extract season/episode (S01E01 or 1x01 format)
    const seasonEpisode = basename.match(/[Ss](\d+)[Ee](\d+)|(\d+)x(\d+)/);
    const season = seasonEpisode ? parseInt(seasonEpisode[1] || seasonEpisode[3]) : null;
    const episode = seasonEpisode ? parseInt(seasonEpisode[2] || seasonEpisode[4]) : null;

    // Extract title (everything before year or season/episode)
    let title = basename;
    if (yearMatch) {
      title = basename.substring(0, basename.indexOf(yearMatch[0]));
    } else if (seasonEpisode) {
      title = basename.substring(0, basename.indexOf(seasonEpisode[0]));
    }

    return {
      title: this.cleanTitle(title),
      year,
      type: season || episode ? 'episode' : 'movie',
      season,
      episode,
      episodes: null,
      resolution: this.detectQuality(basename),
      quality: this.detectQuality(basename),
      source: this.detectSource(basename),
      codec: this.detectCodec(basename),
      audio: null,
      group: null,
      original: basename,
      confidence: 30, // Low confidence for fallback
      parsedWith: 'fallback'
    };
  }

  /**
   * Parse multiple filenames in batch
   * @param {Array<string>} filenames - Array of filenames
   * @returns {Array<Object>} Array of parsed results
   */
  parseBatch(filenames) {
    return filenames.map(filename => this.parse(filename));
  }

  /**
   * Format season/episode string (e.g., "S01E05")
   * @param {number} season - Season number
   * @param {number} episode - Episode number
   * @returns {string} Formatted string
   */
  formatSeasonEpisode(season, episode) {
    if (!season || !episode) return null;

    const s = String(season).padStart(2, '0');
    const e = String(episode).padStart(2, '0');
    return `S${s}E${e}`;
  }

  /**
   * Check if filename appears to be a sample file
   * @param {string} filename - Filename to check
   * @returns {boolean} True if appears to be a sample
   */
  isSample(filename) {
    const samplePatterns = [
      /sample/i,
      /trailer/i,
      /preview/i
    ];

    return samplePatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Extract all episode numbers from a filename (for multi-episode files)
   * @param {string} filename - Filename to parse
   * @returns {Array<number>} Array of episode numbers
   */
  extractAllEpisodes(filename) {
    const episodes = [];

    // Match patterns like E01E02E03 or E01-E03
    const multiEpisode = filename.match(/[Ee](\d+)(?:-[Ee](\d+))?/g);

    if (multiEpisode) {
      multiEpisode.forEach(match => {
        const num = match.match(/\d+/g);
        if (num) {
          episodes.push(...num.map(n => parseInt(n)));
        }
      });
    }

    return episodes;
  }
}

// Create singleton instance
const filenameParser = new FilenameParser();

export default filenameParser;
