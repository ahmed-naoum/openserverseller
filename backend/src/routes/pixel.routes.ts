import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  listUserPixels,
  createPixel,
  updatePixel,
  deletePixel,
  verifyPixel,
  testPixelCapi
} from '../controllers/pixel.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(listUserPixels));
router.post('/', asyncHandler(createPixel));
router.patch('/:id', asyncHandler(updatePixel));
router.delete('/:id', asyncHandler(deletePixel));
router.post('/verify', asyncHandler(verifyPixel));
router.post('/:id/test-capi', asyncHandler(testPixelCapi));

export default router;
