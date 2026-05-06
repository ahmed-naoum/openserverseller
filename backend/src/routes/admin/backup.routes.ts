import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as backupController from '../../controllers/admin/backup.controller.js';

const router = Router();

router.use(authenticate);
router.use(authorize('SUPER_ADMIN'));

router.get('/', backupController.listBackups);
router.post('/manual', backupController.triggerBackup);
router.get('/download/:filename', backupController.downloadBackup);
router.delete('/:filename', backupController.deleteBackup);
router.post('/restore/:filename', backupController.restoreBackup);

export default router;
