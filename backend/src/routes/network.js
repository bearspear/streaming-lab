import express from 'express';
import {
  getNetworkSources,
  getNetworkSource,
  createNetworkSource,
  updateNetworkSource,
  deleteNetworkSource,
  testConnection,
  browseDirectory,
  discoverUPnP,
  getMediaServers
} from '../controllers/networkController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All network routes require authentication
router.use(authenticateToken);

// Network source management
router.get('/sources', getNetworkSources);
router.get('/sources/:id', getNetworkSource);
router.post('/sources', createNetworkSource);
router.put('/sources/:id', updateNetworkSource);
router.delete('/sources/:id', deleteNetworkSource);

// Network source operations
router.post('/sources/:id/test', testConnection);
router.get('/sources/:id/browse', browseDirectory);

// UPnP/DLNA discovery
router.post('/discover', discoverUPnP);
router.get('/media-servers', getMediaServers);

export default router;
