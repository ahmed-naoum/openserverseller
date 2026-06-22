import { prisma } from '../lib/prisma.js';
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { io } from '../index.js';
import { uploadRateLimiter } from '../middleware/security.js';

const router = Router();

// Disable sharp cache to prevent file locking issues on Windows
sharp.cache(false);

// Ensure upload directories exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const productsUploadDir = path.join(uploadsDir, 'products');
if (!fs.existsSync(productsUploadDir)) {
  fs.mkdirSync(productsUploadDir, { recursive: true });
}

const avatarsUploadDir = path.join(uploadsDir, 'avatars');
if (!fs.existsSync(avatarsUploadDir)) {
  fs.mkdirSync(avatarsUploadDir, { recursive: true });
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
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type or extension'));
    }
  },
});

const productImageUpload = multer({
  storage: productImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les formats PNG, JPG, JPEG et WEBP sont acceptés'));
    }
  },
});

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les formats PNG, JPG et WEBP sont acceptés'));
    }
  },
});

// Helper to compress and convert images to WebP
const optimizeAndConvertImage = async (
  filePath: string
): Promise<{ filename: string; size: number; mimetype: string }> => {
  const ext = path.extname(filePath).toLowerCase();
  const dir = path.dirname(filePath);
  
  if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    const baseName = path.basename(filePath, ext);
    const webpFilename = `${baseName}-optimized.webp`;
    const outputPath = path.join(dir, webpFilename);

    // Read the file into memory first to avoid file-locking on Windows
    const fileBuffer = fs.readFileSync(filePath);

    // Sharp strips EXIF metadata automatically unless withMetadata() is explicitly called
    const info = await sharp(fileBuffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(outputPath);

    // Delete the original uncompressed file to save space
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return {
      filename: webpFilename,
      size: info.size,
      mimetype: 'image/webp',
    };
  }

  const stat = fs.statSync(filePath);
  return {
    filename: path.basename(filePath),
    size: stat.size,
    mimetype: ext === '.pdf' ? 'application/pdf' : 'application/octet-stream',
  };
};

// ─── Product Images Upload (PNG/JPG → WebP) ─────────────────────────
router.post(
  '/product-images',
  authenticate,
  uploadRateLimiter,
  authorize('SUPER_ADMIN', 'ADMIN', 'GROSSELLER'),
  productImageUpload.array('images', 10),
  asyncHandler(async (req, res) => {
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      throw new AppException(400, 'Aucune image envoyée');
    }

    const files = req.files as Express.Multer.File[];
    const socketId = req.body.socketId;
    const results: { url: string; filename: string; size: number }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const webpFilename = `${Date.now()}-${Math.round(Math.random() * 1e6)}.webp`;
      const outputPath = path.join(productsUploadDir, webpFilename);

      const info = await sharp(file.buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(outputPath);

      const fileUrl = `/uploads/products/${webpFilename}`;

      results.push({
        url: fileUrl,
        filename: webpFilename,
        size: info.size,
      });

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

// ─── Generic Image Upload (Compress + WebP) ─────────────────────────
router.post(
  '/image',
  authenticate,
  uploadRateLimiter,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppException(400, 'No file uploaded');
    }

    const result = await optimizeAndConvertImage(req.file.path);
    const fileUrl = `/uploads/${result.filename}`;

    res.json({
      status: 'success',
      data: {
        url: fileUrl,
        filename: result.filename,
        size: result.size,
        mimetype: result.mimetype,
      },
    });
  })
);

// ─── KYC Document Upload (Camera & Gallery, Image → WebP) ───────────
router.post(
  '/kyc',
  authenticate,
  uploadRateLimiter,
  upload.array('files', 2),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length !== 2) {
      throw new AppException(400, 'Vous devez envoyer exactement 2 fichiers: Document Recto et Document Verso');
    }

    const files: { url: string; filename: string; size: number }[] = [];
    for (const file of req.files as Express.Multer.File[]) {
      const result = await optimizeAndConvertImage(file.path);
      files.push({
        url: `/uploads/${result.filename}`,
        filename: result.filename,
        size: result.size,
      });
    }

    res.json({
      status: 'success',
      data: { files },
    });
  })
);

// ─── Store Logo Upload (Compress + WebP) ────────────────────────────
router.post(
  '/logo',
  authenticate,
  uploadRateLimiter,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppException(400, 'No file uploaded');
    }

    const result = await optimizeAndConvertImage(req.file.path);
    const fileUrl = `/uploads/${result.filename}`;

    res.json({
      status: 'success',
      data: {
        url: fileUrl,
        filename: result.filename,
        size: result.size,
      },
    });
  })
);

// ─── Bulk Upload (Compress + WebP) ───────────────────────────────────
router.post(
  '/bulk',
  authenticate,
  uploadRateLimiter,
  authorize('SUPER_ADMIN'),
  upload.array('files', 20),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      throw new AppException(400, 'No files uploaded');
    }

    const files: { url: string; filename: string; size: number }[] = [];
    for (const file of req.files as Express.Multer.File[]) {
      const result = await optimizeAndConvertImage(file.path);
      files.push({
        url: `/uploads/${result.filename}`,
        filename: result.filename,
        size: result.size,
      });
    }

    res.json({
      status: 'success',
      data: { files },
    });
  })
);

// ─── Avatar Upload (Crop + WebP) ──────────────────────────────────────
router.post(
  '/avatar',
  authenticate,
  uploadRateLimiter,
  avatarUpload.single('avatar'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppException(400, 'Aucune image envoyée');
    }

    const webpFilename = `avatar-${req.user!.id}-${Date.now()}.webp`;
    const outputPath = path.join(avatarsUploadDir, webpFilename);

    await sharp(req.file.buffer)
      .resize(400, 400, { fit: 'cover', position: 'center' })
      .webp({ quality: 85 })
      .toFile(outputPath);

    const avatarUrl = `/uploads/avatars/${webpFilename}`;

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
