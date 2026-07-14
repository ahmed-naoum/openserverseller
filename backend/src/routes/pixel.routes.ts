import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  listUserPixels,
  createPixel,
  deletePixel,
  verifyPixel
} from '../controllers/pixel.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(listUserPixels));
router.post('/', asyncHandler(createPixel));
router.delete('/:id', asyncHandler(deletePixel));
router.post('/verify', asyncHandler(verifyPixel));

export default router;
