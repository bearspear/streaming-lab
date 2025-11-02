import database from '../config/database.js';
import directStreamService from '../services/streaming/directStreamService.js';
import videoProbeService from '../services/streaming/videoProbeService.js';
import transcodingService from '../services/streaming/transcodingService.js';
import hlsService from '../services/streaming/hlsService.js';
import cacheService from '../services/streaming/cacheService.js';
import { createReadStream } from 'fs';

/**
 * Get video info
 */
export const getVideoInfo = async (req, res) => {
  try {
    const { id } = req.params;

    // Get media item from database
    const mediaItem = await database.get(
      'SELECT * FROM media_items WHERE id = ?',
      [id]
    );

    if (!mediaItem) {
      return res.status(404).json({ error: 'Media item not found' });
    }

    // Probe video file
    const videoInfo = await videoProbeService.getVideoInfo(mediaItem.file_path);

    res.json({
      mediaItem: {
        id: mediaItem.id,
        title: mediaItem.title,
        type: mediaItem.type
      },
      videoInfo
    });
  } catch (error) {
    console.error('Error getting video info:', error);
    res.status(500).json({ error: 'Failed to get video info' });
  }
};

/**
 * Direct stream with range support
 * Auto-transcodes MKV files on-the-fly
 */
export const directStream = async (req, res) => {
  try {
    const { id } = req.params;

    // Get media item from database
    const mediaItem = await database.get(
      'SELECT * FROM media_items WHERE id = ?',
      [id]
    );

    if (!mediaItem) {
      return res.status(404).json({ error: 'Media item not found' });
    }

    // Check file extension
    const fileExt = mediaItem.file_path.toLowerCase().split('.').pop();

    // Auto-transcode MKV files (browsers don't support Matroska container)
    if (fileExt === 'mkv') {
      console.log(`[MKV] Real-time transcoding: ${mediaItem.file_path}`);

      // Use real-time transcoding for MKV files
      transcodingService.streamTranscode(mediaItem.file_path, res, {
        resolution: '1280x720',
        videoBitrate: '2500k',
        audioBitrate: '128k'
      });
    } else {
      // Direct stream for MP4, WebM, etc.
      directStreamService.streamFile(mediaItem.file_path, req, res);
    }
  } catch (error) {
    console.error('Error in direct stream:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream video' });
    }
  }
};

/**
 * Transcode and stream
 */
export const transcodeStream = async (req, res) => {
  try {
    const { id } = req.params;
    const { quality = '720p' } = req.query;

    // Get media item from database
    const mediaItem = await database.get(
      'SELECT * FROM media_items WHERE id = ?',
      [id]
    );

    if (!mediaItem) {
      return res.status(404).json({ error: 'Media item not found' });
    }

    const qualitySettings = {
      '1080p': { resolution: '1920x1080', bitrate: '5000k' },
      '720p': { resolution: '1280x720', bitrate: '2500k' },
      '480p': { resolution: '854x480', bitrate: '1000k' }
    };

    const settings = qualitySettings[quality] || qualitySettings['720p'];

    // Stream with transcoding
    transcodingService.streamTranscode(mediaItem.file_path, res, settings);
  } catch (error) {
    console.error('Error in transcode stream:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to transcode video' });
    }
  }
};

/**
 * Get HLS manifest
 */
export const getHLSManifest = async (req, res) => {
  try {
    const { id } = req.params;

    // Get media item from database
    const mediaItem = await database.get(
      'SELECT * FROM media_items WHERE id = ?',
      [id]
    );

    if (!mediaItem) {
      return res.status(404).json({ error: 'Media item not found' });
    }

    // Check if HLS exists, if not generate it
    if (!hlsService.hlsExists(id)) {
      console.log(`Generating HLS for media item ${id}...`);

      // Generate HLS asynchronously
      hlsService.generateHLS(mediaItem.file_path, id, {
        resolution: '1280x720',
        videoBitrate: '2500k',
        audioBitrate: '128k'
      }).catch(error => {
        console.error('Error generating HLS:', error);
      });

      return res.status(202).json({
        message: 'HLS generation started',
        status: 'processing'
      });
    }

    // Get and return playlist
    const playlistPath = `${hlsService.getHLSDir(id)}/playlist.m3u8`;
    const playlist = hlsService.getPlaylist(playlistPath);

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(playlist);
  } catch (error) {
    console.error('Error getting HLS manifest:', error);
    res.status(500).json({ error: 'Failed to get HLS manifest' });
  }
};

/**
 * Get HLS segment
 */
export const getHLSSegment = async (req, res) => {
  try {
    const { id, segment } = req.params;

    const segmentPath = hlsService.getSegment(id, segment);

    res.setHeader('Content-Type', 'video/mp2t');
    const stream = createReadStream(segmentPath);
    stream.pipe(res);

    stream.on('error', (error) => {
      console.error('Error streaming segment:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream segment' });
      }
    });
  } catch (error) {
    console.error('Error getting HLS segment:', error);
    if (!res.headersSent) {
      res.status(404).json({ error: 'Segment not found' });
    }
  }
};

/**
 * Trigger transcode for specific quality
 */
export const triggerTranscode = async (req, res) => {
  try {
    const { id } = req.params;
    const { quality = '720p' } = req.body;

    // Get media item from database
    const mediaItem = await database.get(
      'SELECT * FROM media_items WHERE id = ?',
      [id]
    );

    if (!mediaItem) {
      return res.status(404).json({ error: 'Media item not found' });
    }

    // Start transcoding asynchronously
    transcodingService.transcodeQuality(mediaItem.file_path, quality, id)
      .then(outputPath => {
        console.log(`Transcode completed: ${outputPath}`);
      })
      .catch(error => {
        console.error('Transcode failed:', error);
      });

    res.json({
      message: 'Transcoding started',
      quality,
      status: 'processing'
    });
  } catch (error) {
    console.error('Error triggering transcode:', error);
    res.status(500).json({ error: 'Failed to start transcoding' });
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = async (req, res) => {
  try {
    const stats = cacheService.getCacheStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({ error: 'Failed to get cache stats' });
  }
};

/**
 * Clear cache
 */
export const clearCache = async (req, res) => {
  try {
    const { mediaItemId } = req.body;

    let result;
    if (mediaItemId) {
      result = cacheService.clearMediaCache(mediaItemId);
    } else {
      result = cacheService.performMaintenance();
    }

    res.json({
      message: 'Cache cleared successfully',
      ...result
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
};

/**
 * Get available qualities for a video
 */
export const getAvailableQualities = async (req, res) => {
  try {
    const { id } = req.params;

    // Get media item from database
    const mediaItem = await database.get(
      'SELECT * FROM media_items WHERE id = ?',
      [id]
    );

    if (!mediaItem) {
      return res.status(404).json({ error: 'Media item not found' });
    }

    // For direct MP4 streaming, we don't need ffprobe
    // Just return empty qualities array (quality switching disabled)
    res.json({
      qualities: [],
      message: 'Using direct streaming (quality selection disabled)'
    });

    // TODO: Uncomment when HLS transcoding is needed:
    // const videoInfo = await videoProbeService.getVideoInfo(mediaItem.file_path);
    // const qualities = videoProbeService.getAvailableQualities(videoInfo);
    // res.json({
    //   sourceQuality: videoInfo.quality,
    //   availableQualities: qualities
    // });
  } catch (error) {
    console.error('Error getting available qualities:', error);
    // Return empty array instead of error to allow video playback
    res.json({
      qualities: [],
      message: 'Quality detection unavailable'
    });
  }
};

/**
 * Pre-transcode MKV file to MP4
 * Creates cached MP4 version for faster playback
 */
export const preTranscodeMKV = async (req, res) => {
  try {
    const { id } = req.params;
    const { quality = '720p' } = req.body;

    // Get media item from database
    const mediaItem = await database.get(
      'SELECT * FROM media_items WHERE id = ?',
      [id]
    );

    if (!mediaItem) {
      return res.status(404).json({ error: 'Media item not found' });
    }

    // Check if file is MKV
    const fileExt = mediaItem.file_path.toLowerCase().split('.').pop();
    if (fileExt !== 'mkv') {
      return res.status(400).json({
        error: 'Only MKV files can be pre-transcoded',
        fileType: fileExt
      });
    }

    console.log(`[Pre-transcode] Starting for media ${id}: ${mediaItem.file_path}`);

    // Start transcoding in background
    transcodingService.transcodeQuality(mediaItem.file_path, quality, id)
      .then(outputPath => {
        console.log(`[Pre-transcode] Completed: ${outputPath}`);
      })
      .catch(error => {
        console.error('[Pre-transcode] Failed:', error);
      });

    res.json({
      message: 'Pre-transcoding started',
      mediaId: id,
      quality,
      status: 'processing',
      note: 'Transcoded file will be cached for faster future playback'
    });
  } catch (error) {
    console.error('Error starting pre-transcode:', error);
    res.status(500).json({ error: 'Failed to start pre-transcoding' });
  }
};

/**
 * Pre-transcode all MKV files in library
 * Batch processing endpoint
 */
export const preTranscodeAllMKV = async (req, res) => {
  try {
    const { quality = '720p' } = req.body;

    // Get all MKV files from database
    const mkvFiles = await database.all(
      "SELECT * FROM media_items WHERE file_path LIKE '%.mkv'"
    );

    if (mkvFiles.length === 0) {
      return res.json({
        message: 'No MKV files found',
        count: 0
      });
    }

    console.log(`[Batch Pre-transcode] Starting for ${mkvFiles.length} MKV files`);

    // Queue all transcodes
    const transcodePromises = mkvFiles.map(mediaItem => {
      console.log(`[Batch] Queuing: ${mediaItem.title} (${mediaItem.id})`);
      return transcodingService.transcodeQuality(mediaItem.file_path, quality, mediaItem.id)
        .then(outputPath => ({
          id: mediaItem.id,
          title: mediaItem.title,
          status: 'completed',
          outputPath
        }))
        .catch(error => ({
          id: mediaItem.id,
          title: mediaItem.title,
          status: 'failed',
          error: error.message
        }));
    });

    // Process sequentially to avoid overwhelming system
    res.json({
      message: 'Batch pre-transcoding started',
      count: mkvFiles.length,
      quality,
      status: 'processing',
      files: mkvFiles.map(f => ({ id: f.id, title: f.title }))
    });

    // Process in background
    Promise.all(transcodePromises)
      .then(results => {
        const completed = results.filter(r => r.status === 'completed').length;
        const failed = results.filter(r => r.status === 'failed').length;
        console.log(`[Batch Pre-transcode] Completed: ${completed}, Failed: ${failed}`);
      })
      .catch(error => {
        console.error('[Batch Pre-transcode] Error:', error);
      });

  } catch (error) {
    console.error('Error starting batch pre-transcode:', error);
    res.status(500).json({ error: 'Failed to start batch pre-transcoding' });
  }
};
