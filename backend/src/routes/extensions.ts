import routes from './index.js';
import analyticsRoutes from './analytics.routes.js';
import uploadRoutes from './upload.routes.js';

routes.use('/analytics', analyticsRoutes);
routes.use('/upload', uploadRoutes);

export default routes;
