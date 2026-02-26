import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getWarehouseDashboard,
  getProductionJobs,
  updateJobStatus,
  getInventory,
  updateInventory,
  createProductionBatch,
} from '../controllers/warehouse.controller.js';

const router = Router();

router.get(
  '/dashboard',
  authenticate,
  authorize('SUPER_ADMIN', 'FULFILLMENT_OPERATOR'),
  getWarehouseDashboard
);

router.get(
  '/jobs',
  authenticate,
  authorize('SUPER_ADMIN', 'FULFILLMENT_OPERATOR'),
  getProductionJobs
);

router.patch(
  '/jobs/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'FULFILLMENT_OPERATOR'),
  updateJobStatus
);

router.get(
  '/inventory',
  authenticate,
  authorize('SUPER_ADMIN', 'FULFILLMENT_OPERATOR'),
  getInventory
);

router.post(
  '/inventory',
  authenticate,
  authorize('SUPER_ADMIN'),
  updateInventory
);

router.post(
  '/batches',
  authenticate,
  authorize('SUPER_ADMIN', 'FULFILLMENT_OPERATOR'),
  createProductionBatch
);

export default router;
