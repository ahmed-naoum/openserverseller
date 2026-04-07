import { Router } from 'express';
import { 
  getMaintenanceStatus, 
  verifyMaintenanceBypass, 
  updateMaintenanceMode,
  getMaintenanceAdminSettings
} from '../controllers/settingsController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Public routes
router.get('/maintenance', getMaintenanceStatus);
router.post('/maintenance/verify', verifyMaintenanceBypass);

// Admin routes (requires authentication and Super Admin role)
router.get('/maintenance/admin', authenticate, authorize('SUPER_ADMIN'), getMaintenanceAdminSettings);
router.put('/maintenance', authenticate, authorize('SUPER_ADMIN'), updateMaintenanceMode);

export default router;
