import express from 'express';
import { requireAdmin } from '../middleware/adminAuth.js';
import {
  getDashboardStats,
  getUsers,
  deleteUser,
  toggleAdminStatus,
  getLibraryStats,
  deleteMediaItem,
  getAllMedia
} from '../controllers/adminController.js';

const router = express.Router();

// All routes require admin authentication
router.use(requireAdmin);

// Dashboard
router.get('/dashboard', getDashboardStats);

// User Management
router.get('/users', getUsers);
router.delete('/users/:userId', deleteUser);
router.put('/users/:userId/admin', toggleAdminStatus);

// Library Management
router.get('/library/stats', getLibraryStats);

// Media Management
router.get('/media', getAllMedia);
router.delete('/media/:mediaId', deleteMediaItem);

export default router;
