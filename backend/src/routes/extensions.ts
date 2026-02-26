import routes from './routes/index.js';
import analyticsRoutes from './routes/analytics.routes.js';
import uploadRoutes from './routes/upload.routes.js';

routes.use('/analytics', analyticsRoutes);
routes.use('/upload', uploadRoutes);

export default routes;
