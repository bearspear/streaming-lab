import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { join } from 'path';
import { mkdirSync, existsSync, readFileSync, readdirSync } from 'fs';

// Set FFmpeg and FFprobe paths
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const CACHE_DIR = process.env.CACHE_DIR || './data/cache';
const SEGMENT_DURATION = parseInt(process.env.HLS_SEGMENT_DURATION) || 10;

class HLSService {
  constructor() {
    this.activeStreams = new Map();
    this.ensureCacheDir();
  }

  /**
   * Ensure cache directory exists
   */
  ensureCacheDir() {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
  }

  /**
   * Generate HLS playlist and segments
   * @param {string} inputPath - Input video path
   * @param {string} mediaItemId - Media item ID
   * @param {Object} options - HLS options
   * @returns {Promise<string>} Playlist path
   */
  async generateHLS(inputPath, mediaItemId, options = {}) {
    const {
      resolution = '1280x720',
      videoBitrate = '2500k',
      audioBitrate = '128k',
      segmentDuration = SEGMENT_DURATION
    } = options;

    const hlsDir = join(CACHE_DIR, `hls_${mediaItemId}`);
    const playlistPath = join(hlsDir, 'playlist.m3u8');
    const segmentPattern = join(hlsDir, 'segment%03d.ts');

    // Check if HLS already generated
    if (existsSync(playlistPath)) {
      console.log(`Using existing HLS playlist: ${playlistPath}`);
      return playlistPath;
    }

    // Create HLS directory
    if (!existsSync(hlsDir)) {
      mkdirSync(hlsDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size(resolution)
        .videoBitrate(videoBitrate)
        .audioBitrate(audioBitrate)
        .format('hls')
        .outputOptions([
          `-hls_time ${segmentDuration}`,
          '-hls_list_size 0', // Include all segments
          '-hls_segment_type mpegts',
          '-start_number 0',
          '-sc_threshold 0', // Disable scene change detection
          '-g 48', // Keyframe interval
          '-keyint_min 48'
        ])
        .output(playlistPath);

      // Store active stream
      this.activeStreams.set(mediaItemId, command);

      // Progress tracking
      command.on('progress', (progress) => {
        console.log(`HLS generation progress: ${progress.percent}%`);
      });

      // Handle completion
      command.on('end', () => {
        console.log(`HLS generation completed: ${playlistPath}`);
        this.activeStreams.delete(mediaItemId);
        resolve(playlistPath);
      });

      // Handle errors
      command.on('error', (err) => {
        console.error('HLS generation error:', err);
        this.activeStreams.delete(mediaItemId);
        reject(err);
      });

      // Start generation
      command.run();
    });
  }

  /**
   * Generate adaptive HLS with multiple quality levels
   * @param {string} inputPath - Input video path
   * @param {string} mediaItemId - Media item ID
   * @param {Array<Object>} qualities - Array of quality configurations
   * @returns {Promise<string>} Master playlist path
   */
  async generateAdaptiveHLS(inputPath, mediaItemId, qualities) {
    const hlsDir = join(CACHE_DIR, `hls_${mediaItemId}`);
    const masterPlaylist = join(hlsDir, 'master.m3u8');

    // Create HLS directory
    if (!existsSync(hlsDir)) {
      mkdirSync(hlsDir, { recursive: true });
    }

    // Generate HLS for each quality
    const playlists = [];
    for (const quality of qualities) {
      const qualityDir = join(hlsDir, quality.label);
      const playlistPath = join(qualityDir, 'playlist.m3u8');

      if (!existsSync(qualityDir)) {
        mkdirSync(qualityDir, { recursive: true });
      }

      try {
        await this.generateHLS(inputPath, `${mediaItemId}_${quality.label}`, {
          resolution: `${quality.width}x${quality.height}`,
          videoBitrate: quality.bitrate,
          audioBitrate: '128k'
        });

        playlists.push({
          path: `${quality.label}/playlist.m3u8`,
          bandwidth: quality.bandwidth,
          resolution: `${quality.width}x${quality.height}`
        });
      } catch (error) {
        console.error(`Error generating HLS for ${quality.label}:`, error);
      }
    }

    // Create master playlist
    const masterContent = this.generateMasterPlaylist(playlists);
    require('fs').writeFileSync(masterPlaylist, masterContent);

    return masterPlaylist;
  }

  /**
   * Generate master playlist content
   * @param {Array<Object>} playlists - Array of playlist info
   * @returns {string} M3U8 content
   */
  generateMasterPlaylist(playlists) {
    let content = '#EXTM3U\n';
    content += '#EXT-X-VERSION:3\n\n';

    for (const playlist of playlists) {
      content += `#EXT-X-STREAM-INF:BANDWIDTH=${playlist.bandwidth},RESOLUTION=${playlist.resolution}\n`;
      content += `${playlist.path}\n\n`;
    }

    return content;
  }

  /**
   * Get playlist content
   * @param {string} playlistPath - Path to playlist file
   * @returns {string} Playlist content
   */
  getPlaylist(playlistPath) {
    try {
      return readFileSync(playlistPath, 'utf8');
    } catch (error) {
      console.error('Error reading playlist:', error);
      throw new Error('Playlist not found');
    }
  }

  /**
   * Get segment file
   * @param {string} mediaItemId - Media item ID
   * @param {string} segmentName - Segment filename
   * @param {string} quality - Quality level (optional)
   * @returns {string} Segment path
   */
  getSegment(mediaItemId, segmentName, quality = null) {
    const basePath = join(CACHE_DIR, `hls_${mediaItemId}`);
    const segmentPath = quality
      ? join(basePath, quality, segmentName)
      : join(basePath, segmentName);

    if (!existsSync(segmentPath)) {
      throw new Error('Segment not found');
    }

    return segmentPath;
  }

  /**
   * List available segments
   * @param {string} mediaItemId - Media item ID
   * @param {string} quality - Quality level (optional)
   * @returns {Array<string>} Segment filenames
   */
  listSegments(mediaItemId, quality = null) {
    const basePath = join(CACHE_DIR, `hls_${mediaItemId}`);
    const dir = quality ? join(basePath, quality) : basePath;

    if (!existsSync(dir)) {
      return [];
    }

    return readdirSync(dir).filter(file => file.endsWith('.ts'));
  }

  /**
   * Cancel active HLS generation
   * @param {string} mediaItemId - Media item ID
   * @returns {boolean} True if cancelled
   */
  cancelGeneration(mediaItemId) {
    const command = this.activeStreams.get(mediaItemId);
    if (command) {
      command.kill('SIGKILL');
      this.activeStreams.delete(mediaItemId);
      return true;
    }
    return false;
  }

  /**
   * Check if HLS exists for media item
   * @param {string} mediaItemId - Media item ID
   * @returns {boolean} True if exists
   */
  hlsExists(mediaItemId) {
    const playlistPath = join(CACHE_DIR, `hls_${mediaItemId}`, 'playlist.m3u8');
    return existsSync(playlistPath);
  }

  /**
   * Get HLS directory path
   * @param {string} mediaItemId - Media item ID
   * @returns {string} HLS directory path
   */
  getHLSDir(mediaItemId) {
    return join(CACHE_DIR, `hls_${mediaItemId}`);
  }
}

// Export singleton instance
const hlsService = new HLSService();
export default hlsService;
