import { prisma } from '../lib/prisma.js';
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { getIO } from '../index.js';
import { uploadRateLimiter } from '../middleware/security.js';
import { exec, spawn } from 'child_process';
import { v2 as cloudinary } from 'cloudinary';
import { getSecret } from '../lib/secretStore.js';

const router = Router();

/**
 * Applies the current Cloudinary credentials to the SDK.
 *
 * Called immediately before every upload rather than once at module load: the
 * module is imported before loadSecrets() finishes, and credentials can be
 * changed from the admin dashboard at any time.
 */
const configureCloudinary = () => {
  cloudinary.config({
    cloud_name: getSecret('CLOUDINARY_CLOUD_NAME'),
    api_key: getSecret('CLOUDINARY_API_KEY'),
    api_secret: getSecret('CLOUDINARY_API_SECRET'),
  });
};

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
  limits: { fileSize: 5 * 1024 * 1024 },
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

const audioUpload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave',
      'audio/ogg', 'audio/webm', 'audio/aac', 'audio/mp4', 'audio/m4a', 'audio/x-m4a',
      'audio/flac', 'audio/x-flac'
    ];
    const allowedExtensions = ['.mp3', '.wav', '.ogg', '.webm', '.aac', '.m4a', '.mp4', '.flac', '.caf', '.wma'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio file type or extension'));
    }
  },
});

const videoUpload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit for videos
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-m4v'];
    const allowedExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.m4v'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Format vidéo invalide. Utilisez MP4, WebM, OGG ou MOV.'));
    }
  },
});

const convertToMp3 = (inputPath: string): Promise<string> => {
  const ext = path.extname(inputPath).toLowerCase();
  const baseName = path.basename(inputPath);

  if (ext === '.mp3') {
    return Promise.resolve(baseName);
  }

  return new Promise((resolve, reject) => {
    const dir = path.dirname(inputPath);
    const fileBase = path.basename(inputPath, path.extname(inputPath));
    const mp3Filename = `${fileBase}.mp3`;
    const outputPath = path.join(dir, mp3Filename);

    const cmd = `ffmpeg -y -i "${inputPath}" -vn -ar 44100 -ac 2 -b:a 192k "${outputPath}"`;
    
    exec(cmd, (error) => {
      if (inputPath !== outputPath && fs.existsSync(inputPath)) {
        try {
          fs.unlinkSync(inputPath);
        } catch (e) {}
      }
      if (error) {
        return reject(error);
      }
      resolve(mp3Filename);
    });
  });
};

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
        const ioInstance = getIO();
        if (ioInstance) {
          ioInstance.to(socketId).emit('upload-progress', {
            current: i + 1,
            total: files.length,
            filename: file.originalname,
            url: fileUrl,
          });
        }
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

// ─── Audio Upload and Transcode to MP3 ─────────────────────────────
router.post(
  '/audio',
  authenticate,
  uploadRateLimiter,
  audioUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppException(400, 'No file uploaded');
    }

    try {
      const mp3Filename = await convertToMp3(req.file.path);
      const fileUrl = `/uploads/${mp3Filename}`;

      res.json({
        status: 'success',
        data: {
          url: fileUrl,
          filename: mp3Filename,
        },
      });
    } catch (err: any) {
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {}
      }
      throw new AppException(500, `Audio conversion failed: ${err.message || err}`);
    }
  })
);

const safeDeleteFile = (filePath?: string) => {
  if (!filePath) return;
  setTimeout(() => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, () => {});
      }
    } catch (e) {}
  }, 1500);
};

const broadcastProgress = (userUuid?: string, socketId?: string, payload?: any) => {
  const ioInstance = getIO();
  if (!ioInstance || !payload) return;
  if (socketId) {
    ioInstance.to(socketId).emit('upload-stage-progress', payload);
  }
  if (userUuid) {
    ioInstance.to(`user:${userUuid}`).emit('upload-stage-progress', payload);
  }
  // Global broadcast fallback to guarantee progress reaches frontend
  ioInstance.emit('upload-stage-progress', payload);
};

const parseFFmpegTime = (timeStr: string): number => {
  if (!timeStr) return 0;
  const clean = timeStr.replace(',', '.');
  const match = clean.match(/(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (match) {
    const h = parseFloat(match[1]);
    const m = parseFloat(match[2]);
    const s = parseFloat(match[3]);
    return h * 3600 + m * 60 + s;
  }
  return 0;
};

const compressVideo = (inputPath: string, userUuid?: string, socketId?: string): Promise<string> => {
  return new Promise((resolve) => {
    const dir = path.dirname(inputPath);
    const fileBase = path.basename(inputPath, path.extname(inputPath));
    const compressedFilename = `${fileBase}-compressed.mp4`;
    const outputPath = path.join(dir, compressedFilename);

    // Guaranteed compression: 720p cap, maxrate 1.2M, crf 32 to keep size strictly < 90MB for Cloudinary
    const args = [
      '-y',
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '32',
      '-maxrate', '1.2M',
      '-bufsize', '2.4M',
      '-vf', 'scale=min(1280\\,iw):min(720\\,ih):force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-c:a', 'aac',
      '-b:a', '64k',
      '-movflags', '+faststart',
      outputPath
    ];

    broadcastProgress(userUuid, socketId, {
      stage: 'vps_compress',
      progress: 5,
      message: '2/4 Démarrage de la compression local FFmpeg sur le serveur VPS...'
    });

    const ffmpeg = spawn('ffmpeg', args);
    let durationSeconds = 0;
    let lastEmittedPercent = 5;

    ffmpeg.stderr.on('data', (data: Buffer) => {
      const str = data.toString();
      
      if (!durationSeconds) {
        const durMatch = str.match(/Duration:\s*(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/i);
        if (durMatch) {
          durationSeconds = parseFFmpegTime(durMatch[1]);
        }
      }

      const timeMatch = str.match(/time=\s*(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/i);
      if (timeMatch) {
        const currentTime = parseFFmpegTime(timeMatch[1]);
        let percent = 0;
        if (durationSeconds > 0) {
          percent = Math.min(99, Math.round((currentTime / durationSeconds) * 100));
        } else {
          percent = Math.min(95, lastEmittedPercent + 5);
        }

        if (percent > lastEmittedPercent) {
          lastEmittedPercent = percent;
          broadcastProgress(userUuid, socketId, {
            stage: 'vps_compress',
            progress: percent,
            message: `2/4 Compression ultra-rapide FFmpeg sur VPS (${percent}%)...`
          });
        }
      }
    });

    ffmpeg.on('close', async (code) => {
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        let finalPath = outputPath;
        const sizeBytes = fs.statSync(outputPath).size;
        const sizeMB = sizeBytes / (1024 * 1024);
        console.log(`[FFmpeg] Initial compression finished: ${sizeMB.toFixed(1)} MB`);

        // If file is still > 90MB (Cloudinary hard limit is 100MB), perform secondary downsizing pass
        if (sizeBytes > 90 * 1024 * 1024) {
          console.warn(`[FFmpeg] File size ${sizeMB.toFixed(1)} MB exceeds 90MB target! Running emergency 2nd pass...`);
          const pass2Filename = `${fileBase}-compressed-small.mp4`;
          const pass2Path = path.join(dir, pass2Filename);

          const pass2Args = [
            '-y',
            '-i', outputPath,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-b:v', '700k',
            '-maxrate', '800k',
            '-bufsize', '1.6M',
            '-r', '24',
            '-vf', 'scale=min(960\\,iw):min(540\\,ih):force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2',
            '-c:a', 'aac',
            '-b:a', '64k',
            '-movflags', '+faststart',
            pass2Path
          ];

          await new Promise<void>((resPass2) => {
            const p2 = spawn('ffmpeg', pass2Args);
            p2.on('close', () => resPass2());
            p2.on('error', () => resPass2());
          });

          if (fs.existsSync(pass2Path) && fs.statSync(pass2Path).size > 0) {
            safeDeleteFile(outputPath);
            finalPath = pass2Path;
            console.log(`[FFmpeg] Emergency 2nd pass complete: ${(fs.statSync(finalPath).size / (1024 * 1024)).toFixed(1)} MB`);
          }
        }

        if (inputPath !== finalPath && fs.existsSync(inputPath)) {
          safeDeleteFile(inputPath);
        }
        broadcastProgress(userUuid, socketId, {
          stage: 'vps_compress',
          progress: 100,
          message: '2/4 Compression local FFmpeg sur VPS terminée !'
        });
        return resolve(finalPath);
      }
      console.warn(`[FFmpeg] Non-zero exit code (${code}), falling back to raw video`);
      broadcastProgress(userUuid, socketId, {
        stage: 'vps_compress',
        progress: 100,
        message: '2/4 FFmpeg terminé, passage à l\'upload Cloudinary...'
      });
      resolve(inputPath);
    });

    ffmpeg.on('error', (err) => {
      console.warn('[FFmpeg Error / Not Installed]', err?.message || err);
      broadcastProgress(userUuid, socketId, {
        stage: 'vps_compress',
        progress: 100,
        message: '2/4 Compression contournée, passage à Cloudinary...'
      });
      resolve(inputPath);
    });
  });
};

// ─── Cloudinary Video Upload (Local VPS Compression + Chunked Cloudinary Upload) ───
router.post(
  '/cloudinary-video',
  authenticate,
  uploadRateLimiter,
  videoUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppException(400, 'Aucun fichier vidéo fourni');
    }

    const socketId = req.body?.socketId;
    const userUuid = (req as any).user?.uuid;
    let currentFilePath = req.file.path;

    try {
      // 1. Compress video locally on VPS with FFmpeg
      currentFilePath = await compressVideo(req.file.path, userUuid, socketId);

      // Verify compressed file exists before Cloudinary upload
      if (!fs.existsSync(currentFilePath)) {
        console.error('[Video Pipeline] ❌ Compressed file does not exist:', currentFilePath);
        throw new Error('Le fichier compressé est introuvable sur le serveur');
      }
      const fileSize = fs.statSync(currentFilePath).size;
      console.log(`[Video Pipeline] 📁 File ready for Cloudinary: ${currentFilePath} (${(fileSize / (1024 * 1024)).toFixed(1)} MB)`);

      // 2. Upload to Cloudinary with Live Progress Stream
      configureCloudinary();
      broadcastProgress(userUuid, socketId, {
        stage: 'cloudinary_upload',
        progress: 0,
        message: '3/4 Connexion à Cloudinary et préparation du transfert...'
      });

      let result: any;
      
      const uploadWithLiveProgress = (filePath: string): Promise<any> => {
        return new Promise((resolve, reject) => {
          const totalBytes = fs.statSync(filePath).size;
          let uploadedBytes = 0;
          let lastPercent = 0;

          const readStream = fs.createReadStream(filePath);

          const cloudStream = cloudinary.uploader.upload_stream(
            {
              resource_type: 'video',
              folder: 'silacod/videos',
            },
            (error, uploadResult) => {
              if (error) {
                return reject(error);
              }
              resolve(uploadResult);
            }
          );

          readStream.on('data', (chunk: Buffer) => {
            uploadedBytes += chunk.length;
            const percent = Math.min(99, Math.round((uploadedBytes / totalBytes) * 100));
            if (percent >= lastPercent + 5) {
              lastPercent = percent;
              broadcastProgress(userUuid, socketId, {
                stage: 'cloudinary_upload',
                progress: percent,
                message: `3/4 Upload Cloudinary live (${percent}%)...`
              });
            }
          });

          readStream.on('error', (err) => reject(err));
          readStream.pipe(cloudStream);
        });
      };

      try {
        result = await uploadWithLiveProgress(currentFilePath);
        console.log('[Video Pipeline] ✅ Cloudinary stream upload complete:', result?.secure_url);
      } catch (cloudErr: any) {
        console.error('[Video Pipeline] ❌ Cloudinary stream upload FAILED:', cloudErr?.message || cloudErr);
        // Fallback: try chunked upload_large
        console.log('[Video Pipeline] 🔄 Trying fallback chunked upload...');
        result = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_large(
            currentFilePath,
            { resource_type: 'video', folder: 'silacod/videos', chunk_size: 6000000 },
            (error: any, uploadResult: any) => {
              if (error) reject(error);
              else resolve(uploadResult);
            }
          );
        });
      }

      if (!result?.secure_url) {
        console.error('[Video Pipeline] ❌ No secure_url in Cloudinary result:', JSON.stringify(result));
        throw new Error('Cloudinary n\'a pas retourné d\'URL');
      }

      broadcastProgress(userUuid, socketId, {
        stage: 'cloudinary_upload',
        progress: 100,
        message: '3/4 Upload Cloudinary terminé !'
      });

      // 3. Deferred safe deletion from VPS
      broadcastProgress(userUuid, socketId, {
        stage: 'vps_cleanup',
        progress: 50,
        message: '4/4 Nettoyage automatique des fichiers du serveur VPS...'
      });

      safeDeleteFile(currentFilePath);
      if (req.file && req.file.path !== currentFilePath) {
        safeDeleteFile(req.file.path);
      }

      broadcastProgress(userUuid, socketId, {
        stage: 'vps_cleanup',
        progress: 100,
        message: '4/4 Nettoyage VPS effectué avec succès !'
      });

      console.log('[Video Pipeline] ✅ Final Cloudinary URL:', result.secure_url);
      
      res.json({
        status: 'success',
        data: {
          url: result.secure_url,
          filename: result.original_filename,
          format: result.format,
          duration: result.duration,
        },
      });
    } catch (err: any) {
      console.error('[Video Pipeline] ❌ Pipeline ERROR:', err?.message || err);
      // Always cleanup local file on VPS if error occurs
      safeDeleteFile(currentFilePath);
      if (req.file && req.file.path !== currentFilePath) {
        safeDeleteFile(req.file.path);
      }
      broadcastProgress(userUuid, socketId, {
        stage: 'error',
        progress: 0,
        message: `Erreur: ${err.message || 'Échec de l\'upload'}`
      });
      throw new AppException(500, `Erreur lors de l'upload Cloudinary: ${err.message || err.error?.message || 'Erreur inconnue'}`);
    }
  })
);

export default router;
