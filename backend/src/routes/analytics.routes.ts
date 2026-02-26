import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getStats, getAgentStats, getAnalytics } from '../controllers/analytics.controller.js';

const router = Router();

router.get('/vendor', authenticate, getStats);
router.get('/agent', authenticate, getAgentStats);
router.get('/analytics', authenticate, getAnalytics);

export default router;
