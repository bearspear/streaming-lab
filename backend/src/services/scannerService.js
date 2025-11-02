import { readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import database from '../config/database.js';
import metadataService from './metadata/metadataService.js';

const VIDEO_EXTENSIONS = (process.env.VIDEO_EXTENSIONS || '.mp4,.mkv,.avi,.mov,.wmv,.flv,.webm')
  .split(',')
  .map(ext => ext.trim().toLowerCase());

const SUBTITLE_EXTENSIONS = ['.srt', '.vtt', '.ass'];

class ScannerService {
  constructor() {
    this.isScanning = false;
    this.scanProgress = {
      totalFiles: 0,
      scannedFiles: 0,
      addedFiles: 0,
      metadataFetched: 0,
      errors: []
    };
  }

  async scanDirectory(directoryPath, sourceType = 'local', sourceConfigId = null) {
    if (this.isScanning) {
      throw new Error('Scan already in progress');
    }

    this.isScanning = true;
    this.scanProgress = {
      totalFiles: 0,
      scannedFiles: 0,
      addedFiles: 0,
      metadataFetched: 0,
      errors: []
    };

    try {
      console.log(`Starting scan of directory: ${directoryPath}`);
      const videoFiles = await this.findVideoFiles(directoryPath);
      this.scanProgress.totalFiles = videoFiles.length;
      console.log(`Found ${videoFiles.length} video files`);

      for (const filePath of videoFiles) {
        try {
          await this.addMediaItem(filePath, sourceType, sourceConfigId);
          this.scanProgress.addedFiles++;
        } catch (error) {
          console.error(`Error adding file ${filePath}:`, error);
          this.scanProgress.errors.push({
            file: filePath,
            error: error.message
          });
        }
        this.scanProgress.scannedFiles++;
      }

      console.log(`Scan complete. Added ${this.scanProgress.addedFiles} files`);
      return this.scanProgress;
    } catch (error) {
      console.error('Scan error:', error);
      throw error;
    } finally {
      this.isScanning = false;
    }
  }

  async findVideoFiles(directoryPath, videoFiles = []) {
    try {
      const entries = await readdir(directoryPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(directoryPath, entry.name);

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          await this.findVideoFiles(fullPath, videoFiles);
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          if (VIDEO_EXTENSIONS.includes(ext)) {
            videoFiles.push(fullPath);
          }
        }
      }

      return videoFiles;
    } catch (error) {
      console.error(`Error reading directory ${directoryPath}:`, error);
      return videoFiles;
    }
  }

  async addMediaItem(filePath, sourceType, sourceConfigId) {
    // Check if file already exists in database
    const existing = await database.get(
      'SELECT id FROM media_items WHERE file_path = ?',
      [filePath]
    );

    if (existing) {
      console.log(`File already in database: ${filePath}`);
      return existing.id;
    }

    // Get file stats
    const stats = await stat(filePath);
    const fileSize = stats.size;

    // Detect if this is a TV show episode
    const episodeInfo = this.parseEpisodeInfo(filePath);

    if (episodeInfo) {
      // Handle TV show episode
      return await this.addTVShowEpisode(filePath, fileSize, episodeInfo, sourceType, sourceConfigId);
    } else {
      // Handle movie
      return await this.addMovie(filePath, fileSize, sourceType, sourceConfigId);
    }
  }

  async addMovie(filePath, fileSize, sourceType, sourceConfigId) {
    const title = this.extractTitleFromFilename(basename(filePath));

    // Insert into database
    const result = await database.run(
      `INSERT INTO media_items
       (type, title, file_path, file_size, source_type, source_config_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['movie', title, filePath, fileSize, sourceType, sourceConfigId]
    );

    const mediaItemId = result.lastID;
    console.log(`Added to database: ${title} (${filePath})`);

    // Auto-fetch metadata if enabled
    const autoFetch = process.env.TMDB_AUTO_FETCH === 'true';
    if (autoFetch) {
      try {
        console.log(`Fetching metadata for: ${title}`);
        await metadataService.processMediaFile(filePath, mediaItemId);
        this.scanProgress.metadataFetched++;
      } catch (error) {
        console.error(`Error fetching metadata for ${title}:`, error.message);
        // Don't fail the scan if metadata fetch fails
      }
    }

    // Scan for subtitle files
    await this.addSubtitlesForMedia(filePath, mediaItemId);

    return mediaItemId;
  }

  async addTVShowEpisode(filePath, fileSize, episodeInfo, sourceType, sourceConfigId) {
    const { showName, seasonNumber, episodeNumber, episodeTitle } = episodeInfo;

    // Find or create TV show
    let tvShow = await database.get(
      'SELECT * FROM tv_shows WHERE title = ?',
      [showName]
    );

    if (!tvShow) {
      // Create media_item for the TV show
      const showMediaResult = await database.run(
        `INSERT INTO media_items (type, title, file_path, source_type)
         VALUES (?, ?, ?, ?)`,
        ['tv_show', showName, filePath.split('/tv-shows/')[0] + '/tv-shows/' + showName, sourceType]
      );

      // Create TV show record
      const tvShowResult = await database.run(
        `INSERT INTO tv_shows (media_item_id, title)
         VALUES (?, ?)`,
        [showMediaResult.lastID, showName]
      );

      tvShow = {
        id: tvShowResult.lastID,
        media_item_id: showMediaResult.lastID,
        title: showName
      };

      console.log(`Created TV show: ${showName}`);
    }

    // Create media_item for the episode
    const fullTitle = `${showName} - S${String(seasonNumber).padStart(2, '0')}E${String(episodeNumber).padStart(2, '0')}${episodeTitle ? ' - ' + episodeTitle : ''}`;

    const episodeMediaResult = await database.run(
      `INSERT INTO media_items
       (type, title, file_path, file_size, source_type, source_config_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['episode', fullTitle, filePath, fileSize, sourceType, sourceConfigId]
    );

    const mediaItemId = episodeMediaResult.lastID;

    // Create episode record
    await database.run(
      `INSERT INTO episodes
       (tv_show_id, season_number, episode_number, media_item_id, title)
       VALUES (?, ?, ?, ?, ?)`,
      [tvShow.id, seasonNumber, episodeNumber, mediaItemId, episodeTitle || `Episode ${episodeNumber}`]
    );

    console.log(`Added episode: ${fullTitle}`);

    return mediaItemId;
  }

  parseEpisodeInfo(filePath) {
    // Check if it's in a tv-shows directory
    if (!filePath.includes('/tv-shows/') && !filePath.includes('\\tv-shows\\')) {
      return null;
    }

    const filename = basename(filePath);

    // Try to match patterns like S01E01, s01e01, 1x01, etc.
    const patterns = [
      /[Ss](\d{1,2})[Ee](\d{1,2})/,  // S01E01 or s01e01
      /(\d{1,2})x(\d{1,2})/           // 1x01
    ];

    for (const pattern of patterns) {
      const match = filename.match(pattern);
      if (match) {
        const seasonNumber = parseInt(match[1], 10);
        const episodeNumber = parseInt(match[2], 10);

        // Extract show name from path
        const pathParts = filePath.split(/[/\\]/);
        const tvShowsIndex = pathParts.findIndex(part => part === 'tv-shows');
        const showName = tvShowsIndex >= 0 ? pathParts[tvShowsIndex + 1] : 'Unknown Show';

        // Try to extract episode title
        let episodeTitle = filename
          .replace(pattern, '')
          .replace(/[Ss]eason\s*\d+/gi, '')
          .replace(/\d{4}/g, '') // Remove year
          .replace(/\b(720p|1080p|2160p|4k|BluRay|WEB-DL|WEBRip|HDTV|x264|x265|HEVC)\b/gi, '')
          .replace(/\.[^/.]+$/, '') // Remove extension
          .replace(/[._-]+/g, ' ')
          .trim();

        episodeTitle = episodeTitle || null;

        return {
          showName,
          seasonNumber,
          episodeNumber,
          episodeTitle
        };
      }
    }

    return null;
  }

  extractTitleFromFilename(filename) {
    // Remove extension
    let title = filename.replace(/\.[^/.]+$/, '');

    // Remove common patterns like year, quality indicators, etc.
    title = title.replace(/\((19|20)\d{2}\)/g, ''); // Remove (2020)
    title = title.replace(/\[(19|20)\d{2}\]/g, ''); // Remove [2020]
    title = title.replace(/\b(19|20)\d{2}\b/g, ''); // Remove 2020
    title = title.replace(/\b(720p|1080p|2160p|4k|BluRay|WEB-DL|WEBRip|HDTV|x264|x265|HEVC)\b/gi, '');

    // Replace dots, underscores with spaces
    title = title.replace(/[._]/g, ' ');

    // Remove extra whitespace
    title = title.replace(/\s+/g, ' ').trim();

    return title || filename;
  }

  async addSubtitlesForMedia(videoFilePath, mediaItemId) {
    try {
      const { dirname, parse } = await import('path');
      const { readdir } = await import('fs/promises');

      const videoDir = dirname(videoFilePath);
      const videoFile = parse(videoFilePath);
      const videoBaseName = videoFile.name; // filename without extension

      // Find subtitle files in the same directory
      const files = await readdir(videoDir);
      const subtitleFiles = files.filter(file => {
        const ext = extname(file).toLowerCase();
        return SUBTITLE_EXTENSIONS.includes(ext) && file.startsWith(videoBaseName);
      });

      // Add each subtitle file to the database
      for (const subtitleFile of subtitleFiles) {
        const subtitlePath = join(videoDir, subtitleFile);
        const subtitleInfo = this.parseSubtitleFilename(subtitleFile, videoBaseName);

        await database.run(
          `INSERT INTO subtitles (media_item_id, language, label, file_path, format)
           VALUES (?, ?, ?, ?, ?)`,
          [
            mediaItemId,
            subtitleInfo.language,
            subtitleInfo.label,
            subtitlePath,
            subtitleInfo.format
          ]
        );

        console.log(`  Added subtitle: ${subtitleInfo.label} (${subtitleInfo.language})`);
      }
    } catch (error) {
      console.error(`Error scanning subtitles for ${videoFilePath}:`, error.message);
    }
  }

  parseSubtitleFilename(filename, videoBaseName) {
    const ext = extname(filename).toLowerCase();
    const format = ext.slice(1); // Remove the dot

    // Remove video basename and extension to get language part
    // e.g., "Movie.2024.en.srt" -> "en"
    const nameWithoutExt = filename.slice(0, -ext.length);
    const languagePart = nameWithoutExt.slice(videoBaseName.length).replace(/^[._-]+/, '');

    // Common language codes
    const languageMap = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese',
      'zh': 'Chinese',
      'ko': 'Korean',
      'ar': 'Arabic',
      'hi': 'Hindi'
    };

    // Extract language code (usually 2-3 letters)
    const langCode = languagePart.toLowerCase().match(/^[a-z]{2,3}/)?.[0] || 'en';
    const language = langCode;
    const label = languageMap[langCode] || langCode.toUpperCase();

    return {
      language,
      label,
      format
    };
  }

  getProgress() {
    return {
      ...this.scanProgress,
      isScanning: this.isScanning
    };
  }
}

// Export singleton instance
const scannerService = new ScannerService();
export default scannerService;
