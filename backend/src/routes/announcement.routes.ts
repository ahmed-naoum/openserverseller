import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  createAnnouncement,
  getMyAnnouncements,
  getAllAnnouncements,
  toggleAnnouncement,
  deleteAnnouncement,
  updateAnnouncement
} from '../controllers/announcement.controller.js';

const router = Router();

// Publicly accessible for logged in users
router.get('/my-announcements', authenticate, asyncHandler(getMyAnnouncements));

// Admin only routes
router.get('/', authenticate, authorize('SUPER_ADMIN'), asyncHandler(getAllAnnouncements));
router.post('/', authenticate, authorize('SUPER_ADMIN'), asyncHandler(createAnnouncement));
router.patch('/:id', authenticate, authorize('SUPER_ADMIN'), asyncHandler(updateAnnouncement));
router.patch('/:id/toggle', authenticate, authorize('SUPER_ADMIN'), asyncHandler(toggleAnnouncement));
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), asyncHandler(deleteAnnouncement));

export default router;
