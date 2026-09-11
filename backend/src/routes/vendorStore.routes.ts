import { Router, Request, Response } from 'express';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import {
  getOrCreateVendorStore,
  updateVendorStore,
  createStoreCollection,
  updateStoreCollection,
  deleteStoreCollection,
  createStorePage,
  updateStorePage,
  deleteStorePage,
} from '../services/store.service.js';
import {
  getStoreCategories,
  createStoreCategory,
  updateStoreCategory,
  deleteStoreCategory,
  listVendorProducts,
  createVendorProduct,
  updateVendorProduct,
  deleteVendorProduct,
  copyDefaultsIntoStore,
  storeOwnsCatalogue,
} from '../services/storeCatalogue.service.js';

const router = Router();

router.use(authenticate, authorize('VENDOR', 'SUPER_ADMIN', 'INFLUENCER'));

router.get(
  '/my-store',
  asyncHandler(async (req: Request, res: Response) => {
    const vendorId = req.user!.id;
    const store = await getOrCreateVendorStore(vendorId);

    res.json({
      status: 'success',
      data: { store },
    });
  })
);

router.put(
  '/my-store',
  asyncHandler(async (req: Request, res: Response) => {
    const vendorId = req.user!.id;
    const updated = await updateVendorStore(vendorId, req.body);

    res.json({
      status: 'success',
      data: { store: updated },
    });
  })
);

router.get(
  '/collections',
  asyncHandler(async (req: Request, res: Response) => {
    const vendorId = req.user!.id;
    const store = await getOrCreateVendorStore(vendorId);

    const collections = await (prisma as any).storeCollection.findMany({
      where: { storeId: store.id },
      orderBy: { sortOrder: 'asc' },
      include: {
        products: {
          select: { id: true, nameFr: true, nameAr: true, priceMad: true, slug: true, sku: true },
        },
      },
    });

    res.json({
      status: 'success',
      data: { collections },
    });
  })
);

router.post(
  '/collections',
  asyncHandler(async (req: Request, res: Response) => {
    const vendorId = req.user!.id;
    const collection = await createStoreCollection(vendorId, req.body);

    res.status(201).json({
      status: 'success',
      data: { collection },
    });
  })
);

router.put(
  '/collections/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const vendorId = req.user!.id;
    const collectionId = parseInt(String(req.params.id || ''), 10);
    if (isNaN(collectionId)) {
      throw new AppException(400, 'Invalid collection id');
    }

    const updated = await updateStoreCollection(vendorId, collectionId, req.body);

    res.json({
      status: 'success',
      data: { collection: updated },
    });
  })
);

router.delete(
  '/collections/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const vendorId = req.user!.id;
    const collectionId = parseInt(String(req.params.id || ''), 10);
    if (isNaN(collectionId)) {
      throw new AppException(400, 'Invalid collection id');
    }

    const result = await deleteStoreCollection(vendorId, collectionId);

    res.json({
      status: 'success',
      data: result,
    });
  })
);

router.get(
  '/pages',
  asyncHandler(async (req: Request, res: Response) => {
    const vendorId = req.user!.id;
    const store = await getOrCreateVendorStore(vendorId);

    const allPages = await (prisma as any).storePage.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: 'desc' },
    });
    // In SQL 'startsWith: __' turns into LIKE '__%' where '_' is a single-character wildcard.
    // We filter reserved template slugs (__header, __footer, etc.) in JS:
    const pages = allPages.filter((p: any) => !String(p.slug || '').startsWith('__'));

    res.json({
      status: 'success',
      data: { pages },
    });
  })
);

router.post(
  '/pages',
  asyncHandler(async (req: Request, res: Response) => {
    const vendorId = req.user!.id;
    const page = await createStorePage(vendorId, req.body);

    res.status(201).json({
      status: 'success',
      data: { page },
    });
  })
);

router.put(
  '/pages/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const vendorId = req.user!.id;
    const pageId = parseInt(String(req.params.id || ''), 10);
    if (isNaN(pageId)) {
      throw new AppException(400, 'Invalid page id');
    }

    const updated = await updateStorePage(vendorId, pageId, req.body);

    res.json({
      status: 'success',
      data: { page: updated },
    });
  })
);

router.delete(
  '/pages/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const vendorId = req.user!.id;
    const pageId = parseInt(String(req.params.id || ''), 10);
    if (isNaN(pageId)) {
      throw new AppException(400, 'Invalid page id');
    }

    const result = await deleteStorePage(vendorId, pageId);

    res.json({
      status: 'success',
      data: result,
    });
  })
);

/* ==========================================================================
   THE SHOP CATALOGUE

   Its own products and its own category tree, with no connection to the
   marketplace `Product` table behind /dashboard/products and the referral
   links at /r/<code>. A product created here can never become a landing page,
   which is the point of keeping the two apart.

   A shop that has created nothing of its own reads the platform starter
   catalogue instead, and every list below says so with `isDefaultCatalogue`.
   Creating one product ends that for good — see storeCatalogue.service.ts.
   ========================================================================== */

router.get(
  '/catalogue',
  asyncHandler(async (req: Request, res: Response) => {
    const store = await getOrCreateVendorStore(req.user!.id);
    const [products, categories, owns] = await Promise.all([
      listVendorProducts(store.id, {
        page: parseInt(String(req.query.page || ''), 10) || 1,
        limit: parseInt(String(req.query.limit || ''), 10) || 24,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        categoryId: req.query.categoryId ? Number(req.query.categoryId) : undefined,
      }),
      getStoreCategories(store.id),
      storeOwnsCatalogue(store.id),
    ]);

    res.json({
      status: 'success',
      data: { ...products, categories: categories.tree, categoriesFlat: categories.flat, ownsCatalogue: owns },
    });
  })
);

router.post(
  '/catalogue/adopt-defaults',
  asyncHandler(async (req: Request, res: Response) => {
    const store = await getOrCreateVendorStore(req.user!.id);
    const result = await copyDefaultsIntoStore(store.id, req.body?.productIds);

    res.status(201).json({
      status: 'success',
      message: `${result.copied} produits copies dans votre boutique`,
      data: result,
    });
  })
);

// ------------------------------------------------------------------ products

/* Ahead of '/products/:id' on purpose: Express takes the first route that
   matches, and 'visibility' would otherwise be read as an id. */
router.put(
  '/products/visibility',
  asyncHandler(async (req: Request, res: Response) => {
    const store = await getOrCreateVendorStore(req.user!.id);
    const { productId, showInStore, sortOrder, storeSortOrder } = req.body;
    const order = sortOrder ?? storeSortOrder;

    const product = await updateVendorProduct(store.id, Number(productId), {
      ...(showInStore !== undefined ? { showInStore } : {}),
      ...(order !== undefined ? { sortOrder: order } : {}),
    });

    res.json({
      status: 'success',
      data: { product },
    });
  })
);

router.get(
  '/products',
  asyncHandler(async (req: Request, res: Response) => {
    const store = await getOrCreateVendorStore(req.user!.id);
    const result = await listVendorProducts(store.id, {
      page: parseInt(String(req.query.page || ''), 10) || 1,
      limit: parseInt(String(req.query.limit || ''), 10) || 24,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      categoryId: req.query.categoryId ? Number(req.query.categoryId) : undefined,
    });

    res.json({ status: 'success', data: result });
  })
);

router.post(
  '/products',
  asyncHandler(async (req: Request, res: Response) => {
    const store = await getOrCreateVendorStore(req.user!.id);
    const product = await createVendorProduct(store.id, req.body);

    res.status(201).json({
      status: 'success',
      message: 'Produit cree',
      data: { product },
    });
  })
);

router.put(
  '/products/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const store = await getOrCreateVendorStore(req.user!.id);
    const productId = parseInt(String(req.params.id || ''), 10);
    if (isNaN(productId)) throw new AppException(400, 'Identifiant de produit invalide');

    const product = await updateVendorProduct(store.id, productId, req.body);

    res.json({ status: 'success', data: { product } });
  })
);

router.delete(
  '/products/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const store = await getOrCreateVendorStore(req.user!.id);
    const productId = parseInt(String(req.params.id || ''), 10);
    if (isNaN(productId)) throw new AppException(400, 'Identifiant de produit invalide');

    const result = await deleteVendorProduct(store.id, productId);

    res.json({
      status: 'success',
      message: result.archived
        ? 'Produit masque: il figure sur des commandes deja expediees'
        : 'Produit supprime',
      data: result,
    });
  })
);

// ---------------------------------------------------------------- categories

router.get(
  '/categories',
  asyncHandler(async (req: Request, res: Response) => {
    const store = await getOrCreateVendorStore(req.user!.id);
    const result = await getStoreCategories(store.id);

    res.json({
      status: 'success',
      data: { categories: result.tree, flat: result.flat, isDefaultCatalogue: result.isDefault },
    });
  })
);

router.post(
  '/categories',
  asyncHandler(async (req: Request, res: Response) => {
    const store = await getOrCreateVendorStore(req.user!.id);
    const category = await createStoreCategory(store.id, req.body);

    res.status(201).json({ status: 'success', data: { category } });
  })
);

router.put(
  '/categories/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const store = await getOrCreateVendorStore(req.user!.id);
    const categoryId = parseInt(String(req.params.id || ''), 10);
    if (isNaN(categoryId)) throw new AppException(400, 'Identifiant de categorie invalide');

    const category = await updateStoreCategory(store.id, categoryId, req.body);

    res.json({ status: 'success', data: { category } });
  })
);

router.delete(
  '/categories/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const store = await getOrCreateVendorStore(req.user!.id);
    const categoryId = parseInt(String(req.params.id || ''), 10);
    if (isNaN(categoryId)) throw new AppException(400, 'Identifiant de categorie invalide');

    const result = await deleteStoreCategory(store.id, categoryId);

    res.json({
      status: 'success',
      message: 'Categorie supprimee',
      data: result,
    });
  })
);

export default router;
