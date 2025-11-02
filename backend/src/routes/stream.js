import express from 'express';
import {
  getVideoInfo,
  directStream,
  transcodeStream,
  getHLSManifest,
  getHLSSegment,
  triggerTranscode,
  getCacheStats,
  clearCache,
  getAvailableQualities,
  preTranscodeMKV,
  preTranscodeAllMKV
} from '../controllers/streamController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All streaming routes require authentication
router.use(authenticateToken);

// Video info
router.get('/:id/info', getVideoInfo);
router.get('/:id/qualities', getAvailableQualities);

// Direct streaming (auto-transcodes MKV files)
router.get('/:id/direct', directStream);

// Transcoded streaming
router.get('/:id/transcode', transcodeStream);
router.post('/:id/transcode', triggerTranscode);

// MKV Pre-transcoding
router.post('/:id/pretranscode', preTranscodeMKV);
router.post('/pretranscode/all', preTranscodeAllMKV);

// HLS streaming
router.get('/:id/hls/manifest.m3u8', getHLSManifest);
router.get('/:id/hls/:segment', getHLSSegment);

// Cache management
router.get('/cache/stats', getCacheStats);
router.post('/cache/clear', clearCache);

export default router;
