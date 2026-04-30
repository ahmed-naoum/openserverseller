import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { io } from '../index.js';

const router = Router();
const prisma = new PrismaClient();

// Ensure uploads/products directory exists
const productsUploadDir = path.join(process.cwd(), 'uploads', 'products');
if (!fs.existsSync(productsUploadDir)) {
  fs.mkdirSync(productsUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.round(Math.random() * 1e9));
    cb(null, uniqueSuffix + path.extname(file.originalname).toLowerCase());
  },
});

const productImageStorage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

const productImageUpload = multer({
  storage: productImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les formats PNG, JPG, JPEG et WEBP sont acceptés'));
    }
  },
});

// ─── Product Images Upload (PNG/JPG → WebP) ─────────────────────────
router.post(
  '/product-images',
  authenticate,
  authorize('SUPER_ADMIN', 'ADMIN', 'GROSSELLER'),
  productImageUpload.array('images', 10),
  asyncHandler(async (req, res) => {
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      throw new AppException(400, 'Aucune image envoyée');
    }

    const files = req.files as Express.Multer.File[];
    const socketId = req.body.socketId;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const results: { url: string; filename: string; size: number }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const webpFilename = `${Date.now()}-${Math.round(Math.random() * 1e6)}.webp`;
      const outputPath = path.join(productsUploadDir, webpFilename);

      // Convert to WebP
      const info = await sharp(file.buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(outputPath);

      const fileUrl = `${baseUrl}/uploads/products/${webpFilename}`;

      results.push({
        url: fileUrl,
        filename: webpFilename,
        size: info.size,
      });

      // Emit progress via Socket.IO
      if (socketId) {
        io.to(socketId).emit('upload-progress', {
          current: i + 1,
          total: files.length,
          filename: file.originalname,
          url: fileUrl,
        });
      }
    }

    res.json({
      status: 'success',
      data: { images: results },
    });
  })
);

// ─── Generic image upload ─────────────────────────────────────────────
router.post(
  '/image',
  authenticate,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppException(400, 'No file uploaded');
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    res.json({
      status: 'success',
      data: {
        url: fileUrl,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  })
);

router.post(
  '/kyc',
  authenticate,
  upload.array('files', 3),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length !== 3) {
      throw new AppException(400, 'Vous devez envoyer exactement 3 fichiers: Document Recto, Document Verso, et Photo Faciale');
    }

    const files = (req.files as Express.Multer.File[]).map((file) => ({
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      size: file.size,
    }));

    res.json({
      status: 'success',
      data: { files },
    });
  })
);

router.post(
  '/logo',
  authenticate,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppException(400, 'No file uploaded');
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    res.json({
      status: 'success',
      data: {
        url: fileUrl,
        filename: req.file.filename,
      },
    });
  })
);

router.post(
  '/bulk',
  authenticate,
  authorize('SUPER_ADMIN'),
  upload.array('files', 20),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      throw new AppException(400, 'No files uploaded');
    }

    const files = (req.files as Express.Multer.File[]).map((file) => ({
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      size: file.size,
    }));

    res.json({
      status: 'success',
      data: { files },
    });
  })
);

// ─── Avatar Upload (Crop + WebP) ──────────────────────────────────────
const avatarsUploadDir = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(avatarsUploadDir)) {
  fs.mkdirSync(avatarsUploadDir, { recursive: true });
}

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les formats PNG, JPG et WEBP sont acceptés'));
    }
  },
});

router.post(
  '/avatar',
  authenticate,
  avatarUpload.single('avatar'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppException(400, 'Aucune image envoyée');
    }

    const webpFilename = `avatar-${req.user!.id}-${Date.now()}.webp`;
    const outputPath = path.join(avatarsUploadDir, webpFilename);

    // Resize to 400x400 square and convert to WebP
    await sharp(req.file.buffer)
      .resize(400, 400, { fit: 'cover', position: 'center' })
      .webp({ quality: 85 })
      .toFile(outputPath);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const avatarUrl = `${baseUrl}/uploads/avatars/${webpFilename}`;

    // Update user profile
    await prisma.userProfile.upsert({
      where: { userId: req.user!.id },
      create: {
        userId: req.user!.id,
        avatarUrl,
      },
      update: {
        avatarUrl,
      },
    });

    // Delete old avatar file if it exists
    try {
      const oldProfile = await prisma.userProfile.findUnique({ where: { userId: req.user!.id } });
      if (oldProfile?.avatarUrl && oldProfile.avatarUrl !== avatarUrl) {
        const oldFilename = oldProfile.avatarUrl.split('/').pop();
        if (oldFilename && oldFilename.startsWith('avatar-')) {
          const oldPath = path.join(avatarsUploadDir, oldFilename);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }
      }
    } catch (e) {
      // Ignore cleanup errors
    }

    res.json({
      status: 'success',
      data: {
        avatarUrl,
      },
    });
  })
);

export default router;
