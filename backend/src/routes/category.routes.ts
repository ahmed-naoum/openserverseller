import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';

const router = Router();
const prisma = new PrismaClient();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
        children: true,
      },
      orderBy: { nameFr: 'asc' },
    });

    const buildTree = (cats: any[], parentId: bigint | null = null): any[] => {
      return cats
        .filter((c) => c.parentId === parentId)
        .map((c) => ({
          id: c.id,
          nameAr: c.nameAr,
          nameFr: c.nameFr,
          nameEn: c.nameEn,
          slug: c.slug,
          imageUrl: c.imageUrl,
          productsCount: c._count.products,
          children: buildTree(cats, c.id),
        }));
    };

    res.json({
      status: 'success',
      data: {
        categories: buildTree(categories),
        flat: categories.map((c) => ({
          id: c.id,
          nameAr: c.nameAr,
          nameFr: c.nameFr,
          nameEn: c.nameEn,
          slug: c.slug,
          imageUrl: c.imageUrl,
          parentId: c.parentId,
          productsCount: c._count.products,
        })),
      },
    });
  })
);

router.post(
  '/',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const { nameAr, nameFr, nameEn, parentId, slug, imageUrl } = req.body;

    const existingCategory = await prisma.category.findUnique({
      where: { slug },
    });

    if (existingCategory) {
      throw new AppException(409, 'Category with this slug already exists');
    }

    const category = await prisma.category.create({
      data: {
        nameAr,
        nameFr,
        nameEn,
        parentId: parentId ? Number(parentId) : null,
        slug,
        imageUrl,
      },
    });

    res.status(201).json({
      status: 'success',
      message: 'Category created successfully',
      data: { category },
    });
  })
);

router.patch(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    const category = await prisma.category.update({
      where: { id: Number(id) },
      data: updateData,
    });

    res.json({
      status: 'success',
      message: 'Category updated successfully',
      data: { category },
    });
  })
);

router.delete(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Optional: Check if category has products before deleting, or let Prisma handle cascade/restrict
    // Currently Prisma schema has Products and Categories as implicitly Many-to-Many
    // and parent/children relations.
    const childrenCount = await prisma.category.count({
      where: { parentId: Number(id) }
    });

    if (childrenCount > 0) {
      throw new AppException(400, 'Cannot delete a category that has sub-categories');
    }

    await prisma.category.delete({
      where: { id: Number(id) },
    });

    res.json({
      status: 'success',
      message: 'Category deleted successfully',
    });
  })
);

export default router;
