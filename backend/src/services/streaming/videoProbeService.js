import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

// Set FFmpeg and FFprobe paths
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

class VideoProbeService {
  /**
   * Get video metadata using ffprobe
   * @param {string} filePath - Path to video file
   * @returns {Promise<Object>} Video metadata
   */
  async getVideoInfo(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          console.error('Error probing video:', err);
          reject(err);
        } else {
          resolve(this.parseMetadata(metadata));
        }
      });
    });
  }

  /**
   * Parse ffprobe metadata into useful format
   * @param {Object} metadata - Raw ffprobe metadata
   * @returns {Object} Parsed metadata
   */
  parseMetadata(metadata) {
    const videoStream = metadata.streams.find(s => s.codec_type === 'video');
    const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

    return {
      duration: parseFloat(metadata.format.duration) || 0,
      size: parseInt(metadata.format.size) || 0,
      bitrate: parseInt(metadata.format.bit_rate) || 0,
      format: metadata.format.format_name,
      video: videoStream ? {
        codec: videoStream.codec_name,
        width: videoStream.width,
        height: videoStream.height,
        fps: this.parseFps(videoStream.r_frame_rate),
        bitrate: parseInt(videoStream.bit_rate) || 0,
        profile: videoStream.profile,
        level: videoStream.level,
        pixelFormat: videoStream.pix_fmt
      } : null,
      audio: audioStream ? {
        codec: audioStream.codec_name,
        sampleRate: parseInt(audioStream.sample_rate) || 0,
        channels: audioStream.channels,
        bitrate: parseInt(audioStream.bit_rate) || 0
      } : null,
      quality: this.detectQuality(videoStream)
    };
  }

  /**
   * Parse frame rate string to number
   * @param {string} fpsString - Frame rate string (e.g., "30/1")
   * @returns {number} Frame rate
   */
  parseFps(fpsString) {
    if (!fpsString) return 0;
    const parts = fpsString.split('/');
    if (parts.length === 2) {
      return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return parseFloat(fpsString);
  }

  /**
   * Detect video quality based on resolution
   * @param {Object} videoStream - Video stream metadata
   * @returns {string} Quality label
   */
  detectQuality(videoStream) {
    if (!videoStream) return 'unknown';

    const height = videoStream.height;

    if (height >= 2160) return '4K';
    if (height >= 1440) return '2K';
    if (height >= 1080) return '1080p';
    if (height >= 720) return '720p';
    if (height >= 480) return '480p';
    if (height >= 360) return '360p';

    return 'SD';
  }

  /**
   * Get available quality options for transcoding
   * @param {Object} videoInfo - Video metadata
   * @returns {Array<Object>} Available quality options
   */
  getAvailableQualities(videoInfo) {
    if (!videoInfo.video) return [];

    const sourceHeight = videoInfo.video.height;
    const qualities = [
      { label: '4K', height: 2160, bitrate: '8000k' },
      { label: '1080p', height: 1080, bitrate: '5000k' },
      { label: '720p', height: 720, bitrate: '2500k' },
      { label: '480p', height: 480, bitrate: '1000k' },
      { label: '360p', height: 360, bitrate: '600k' }
    ];

    // Only include qualities equal to or lower than source
    return qualities.filter(q => q.height <= sourceHeight);
  }

  /**
   * Check if video needs transcoding
   * @param {Object} videoInfo - Video metadata
   * @returns {boolean} True if transcoding is needed
   */
  needsTranscoding(videoInfo) {
    if (!videoInfo.video) return false;

    // Check if codec is web-compatible
    const webCompatibleCodecs = ['h264', 'vp8', 'vp9'];
    const codec = videoInfo.video.codec.toLowerCase();

    if (!webCompatibleCodecs.includes(codec)) {
      return true;
    }

    // Check if resolution is too high
    if (videoInfo.video.height > 1080) {
      return true;
    }

    return false;
  }
}

// Export singleton instance
const videoProbeService = new VideoProbeService();
export default videoProbeService;
