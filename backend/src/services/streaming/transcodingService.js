import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

// Set FFmpeg and FFprobe paths
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const CACHE_DIR = process.env.CACHE_DIR || './data/cache';

class TranscodingService {
  constructor() {
    this.activeTranscodes = new Map();
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
   * Transcode video to MP4 with H.264
   * @param {string} inputPath - Input video path
   * @param {string} outputPath - Output video path
   * @param {Object} options - Transcoding options
   * @returns {Promise<string>} Output file path
   */
  async transcodeToMP4(inputPath, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
      const {
        resolution = '1280x720',
        videoBitrate = '2500k',
        audioBitrate = '128k',
        fps = 30,
        preset = 'medium'
      } = options;

      const command = ffmpeg(inputPath)
        .output(outputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size(resolution)
        .videoBitrate(videoBitrate)
        .audioBitrate(audioBitrate)
        .fps(fps)
        .preset(preset)
        .format('mp4')
        .outputOptions([
          '-movflags +faststart', // Enable streaming
          '-profile:v high',
          '-level 4.0'
        ]);

      // Store active transcode
      this.activeTranscodes.set(outputPath, command);

      // Progress tracking
      command.on('progress', (progress) => {
        console.log(`Transcoding progress: ${progress.percent}%`);
      });

      // Handle completion
      command.on('end', () => {
        console.log(`Transcoding completed: ${outputPath}`);
        this.activeTranscodes.delete(outputPath);
        resolve(outputPath);
      });

      // Handle errors
      command.on('error', (err) => {
        console.error('Transcoding error:', err);
        this.activeTranscodes.delete(outputPath);
        reject(err);
      });

      // Start transcoding
      command.run();
    });
  }

  /**
   * Transcode video with specific quality
   * @param {string} inputPath - Input video path
   * @param {string} quality - Quality label (e.g., '720p', '1080p')
   * @param {string} mediaItemId - Media item ID for caching
   * @returns {Promise<string>} Output file path
   */
  async transcodeQuality(inputPath, quality, mediaItemId) {
    const qualitySettings = {
      '4K': { resolution: '3840x2160', bitrate: '8000k', fps: 30 },
      '1080p': { resolution: '1920x1080', bitrate: '5000k', fps: 30 },
      '720p': { resolution: '1280x720', bitrate: '2500k', fps: 30 },
      '480p': { resolution: '854x480', bitrate: '1000k', fps: 24 },
      '360p': { resolution: '640x360', bitrate: '600k', fps: 24 }
    };

    const settings = qualitySettings[quality] || qualitySettings['720p'];
    const outputFileName = `${mediaItemId}_${quality}.mp4`;
    const outputPath = join(CACHE_DIR, outputFileName);

    // Check if already transcoded
    if (existsSync(outputPath)) {
      console.log(`Using cached transcode: ${outputPath}`);
      return outputPath;
    }

    return this.transcodeToMP4(inputPath, outputPath, {
      resolution: settings.resolution,
      videoBitrate: settings.bitrate,
      fps: settings.fps,
      preset: 'fast' // Faster transcoding for real-time
    });
  }

  /**
   * Stream transcoded video in real-time
   * @param {string} inputPath - Input video path
   * @param {Object} res - Express response object
   * @param {Object} options - Transcoding options
   */
  streamTranscode(inputPath, res, options = {}) {
    const {
      resolution = '1280x720',
      videoBitrate = '2500k',
      audioBitrate = '128k'
    } = options;

    const command = ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .size(resolution)
      .videoBitrate(videoBitrate)
      .audioBitrate(audioBitrate)
      .format('mp4')
      .outputOptions([
        '-movflags +frag_keyframe+empty_moov+default_base_moof',
        '-preset ultrafast' // Fastest for real-time streaming
      ]);

    // Set response headers
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Transfer-Encoding': 'chunked'
    });

    // Pipe to response
    command.pipe(res, { end: true });

    // Handle errors
    command.on('error', (err) => {
      console.error('Stream transcode error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Transcoding failed' });
      }
    });

    // Handle client disconnect
    res.on('close', () => {
      console.log('Client disconnected, killing transcode');
      command.kill('SIGKILL');
    });
  }

  /**
   * Cancel active transcode
   * @param {string} outputPath - Output path of transcode to cancel
   * @returns {boolean} True if cancelled
   */
  cancelTranscode(outputPath) {
    const command = this.activeTranscodes.get(outputPath);
    if (command) {
      command.kill('SIGKILL');
      this.activeTranscodes.delete(outputPath);
      return true;
    }
    return false;
  }

  /**
   * Get transcode progress
   * @param {string} outputPath - Output path
   * @returns {Object|null} Progress info
   */
  getProgress(outputPath) {
    return this.activeTranscodes.has(outputPath) ? {
      active: true,
      outputPath
    } : null;
  }

  /**
   * Extract video thumbnail
   * @param {string} inputPath - Input video path
   * @param {string} outputPath - Output thumbnail path
   * @param {number} timestamp - Timestamp in seconds
   * @returns {Promise<string>} Thumbnail path
   */
  async extractThumbnail(inputPath, outputPath, timestamp = 10) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: [timestamp],
          filename: outputPath,
          folder: CACHE_DIR,
          size: '320x240'
        })
        .on('end', () => {
          const thumbPath = join(CACHE_DIR, outputPath);
          console.log(`Thumbnail created: ${thumbPath}`);
          resolve(thumbPath);
        })
        .on('error', (err) => {
          console.error('Thumbnail error:', err);
          reject(err);
        });
    });
  }
}

// Export singleton instance
const transcodingService = new TranscodingService();
export default transcodingService;
