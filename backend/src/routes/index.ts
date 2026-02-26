import { Router } from 'express';
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

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/brands', brandRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/leads', leadRoutes);
router.use('/orders', orderRoutes);
router.use('/wallet', walletRoutes);
router.use('/payouts', payoutRoutes);
router.use('/couriers', courierRoutes);
router.use('/warehouse', warehouseRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/public', publicRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/upload', uploadRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/fulfillment', fulfillmentRoutes);
router.use('/chat', chatRoutes);

export default router;
