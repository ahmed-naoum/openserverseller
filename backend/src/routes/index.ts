import express, { Router } from 'express';
import path from 'path';
import { auditLog, honeypotTrap } from '../middleware/security.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import userSettingsRoutes from './userSettings.routes.js';
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
import damanesignWebhookRoutes from './damanesign-webhook.routes.js';
import youcanRoutes from './youcan.routes.js';
import shopifyRoutes from './shopify.routes.js';
import woocommerceRoutes from './woocommerce.routes.js';
import supportRoutes from './support.routes.js';
import invoiceRoutes from './invoice.routes.js';
import backupRoutes from './admin/backup.routes.js';
import secretRoutes from './secrets.routes.js';
import deployRoutes from './deploy.routes.js';
import pixelRoutes from './pixel.routes.js';
import domainRoutes from './domain.routes.js';
import customProductRoutes from './customProduct.routes.js';
import eventRoutes from './event.routes.js';
import googleSheetsRoutes from './googleSheets.routes.js';
import helperRoutes from './helper.routes.js';
import vendorSubAccountRoutes from './vendorSubAccount.routes.js';


const router = Router();

// Honeypots to auto-block and record scanning attempts
router.use(['/admin-old', '/wp-admin', '/phpmyadmin', '/.env'], honeypotTrap);

router.get('/health', (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    ...(isProd ? {} : { version: '1.0.0', env: process.env.NODE_ENV || 'development' }),
  });
});

// Serve uploads under API prefix as a fallback
router.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

router.use('/auth', authRoutes);
router.use('/user', auditLog, userSettingsRoutes);
router.use('/users', auditLog, userRoutes);
router.use('/products', auditLog, productRoutes);
router.use('/categories', auditLog, categoryRoutes);
router.use('/leads', auditLog, leadRoutes);
router.use('/invoices', auditLog, invoiceRoutes);
router.use('/orders', auditLog, orderRoutes);
router.use('/wallet', auditLog, walletRoutes);
router.use('/payouts', auditLog, payoutRoutes);
router.use('/couriers', courierRoutes);
router.use('/warehouse', warehouseRoutes);
router.use('/notifications', notificationRoutes);

// Register specific admin sub-routes BEFORE the general /admin route
router.use('/admin/backups', backupRoutes);
router.use('/admin/security', securityRoutes);
// Secrets are deliberately NOT behind auditLog.
//
// The generic middleware records req.body, and sensitiveDataMasking() only
// redacts when the *key name* looks sensitive ('password', 'token', ...). The
// body here is `{ value: "<the credential>" }` — the key is literally `value`,
// so nothing matched and every submitted secret was written verbatim into
// activity_logs, into the hash-chained immutable audit log (where it cannot be
// deleted without breaking chain verification), and into the external log
// stream. That log is readable by FINANCE_ADMIN and SYSTEM_SUPPORT, who are not
// allowed on the secrets page at all.
//
// secrets.routes.ts writes its own audit entry instead: which key, by whom,
// never the value.
router.use('/admin/secrets', secretRoutes);

// Deployments. Deliberately NOT behind auditLog: the router carries GitHub's
// push payload, which is large and would be written verbatim into activity_logs
// on every push. Deploy actions are audited by the Deployment table itself,
// which records who triggered what, when, and with which result.
router.use('/deploy', deployRoutes);

router.use('/admin', auditLog, adminRoutes);

router.use('/public', publicRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/upload', uploadRoutes);
router.use('/inventory', auditLog, inventoryRoutes);
router.use('/fulfillment', auditLog, fulfillmentRoutes);
router.use('/chat', chatRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/announcements', auditLog, announcementRoutes);
router.use('/influencer', auditLog, influencerRoutes);
router.use('/settings', auditLog, settingsRoutes);
router.use('/webhooks/damanesign', damanesignWebhookRoutes);
router.use('/webhooks', auditLog, webhookRoutes);
router.use('/youcan', auditLog, youcanRoutes);
router.use('/shopify', auditLog, shopifyRoutes);
router.use('/woocommerce', auditLog, woocommerceRoutes);
router.use('/integrations/woocommerce', auditLog, woocommerceRoutes);
router.use('/integrations/shopify', auditLog, shopifyRoutes);
router.use('/google-sheets', auditLog, googleSheetsRoutes);
router.use('/integrations/google-sheets', auditLog, googleSheetsRoutes);
router.use('/support', auditLog, supportRoutes);
router.use('/user-pixels', auditLog, pixelRoutes);
router.use('/domain', auditLog, domainRoutes);
router.use('/custom-products', auditLog, customProductRoutes);
router.use('/event', eventRoutes);
router.use('/helper', auditLog, helperRoutes);
router.use('/vendor/sub-accounts', auditLog, vendorSubAccountRoutes);


export default router;
