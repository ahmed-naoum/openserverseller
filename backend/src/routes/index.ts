import { Router } from 'express';
import { auditLog } from '../middleware/security.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import brandRoutes from './brand.routes.js';
import productRoutes from './product.routes.js';
import categoryRoutes from './category.routes.js';
import leadRoutes from './lead.routes.js';
import orderRoutes from './order.routes.js';
import walletRoutes from './wallet.routes.js';
import payoutRoutes from './payout.routes.js';
import courierRoutes from './courier.routes.js';
import warehouseRoutes from './warehouse.routes.js';
import notificationRoutes from './notification.routes.js';
import adminRoutes from './admin.routes.js';
import publicRoutes from './public.routes.js';
import analyticsRoutes from './analytics.routes.js';
import uploadRoutes from './upload.routes.js';
import inventoryRoutes from './inventory.routes.js';
import fulfillmentRoutes from './fulfillment.routes.js';
import chatRoutes from './chat.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import influencerRoutes from './influencer.routes.js';
import announcementRoutes from './announcement.routes.js';
import settingsRoutes from './settings.routes.js';
import securityRoutes from './security.routes.js';
import webhookRoutes from './webhook.routes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0', // Keeping version is generally okay unless it exposes specific library versions
  });
});

router.use('/auth', authRoutes);
router.use('/users', auditLog, userRoutes);
router.use('/brands', auditLog, brandRoutes);
router.use('/products', auditLog, productRoutes);
router.use('/categories', categoryRoutes);
router.use('/leads', auditLog, leadRoutes);
router.use('/orders', auditLog, orderRoutes);
router.use('/wallet', auditLog, walletRoutes);
router.use('/payouts', auditLog, payoutRoutes);
router.use('/couriers', courierRoutes);
router.use('/warehouse', warehouseRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', auditLog, adminRoutes);
router.use('/public', publicRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/upload', uploadRoutes);
router.use('/inventory', auditLog, inventoryRoutes);
router.use('/fulfillment', fulfillmentRoutes);
router.use('/chat', chatRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/announcements', announcementRoutes);
router.use('/influencer', auditLog, influencerRoutes);
router.use('/settings', settingsRoutes);
router.use('/admin/security', securityRoutes);
router.use('/webhooks', webhookRoutes);

export default router;
