const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { upload, uploadDir } = require('../config/multerConfig');

// Helper to format file metadata response
function formatFileInfo(req, file) {
  const host = process.env.HOST || `${req.protocol}://${req.get('host')}`;
  const fileUrl = `${host}/uploads/${file.filename}`;
  
  return {
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    sizeFormatted: formatBytes(file.size),
    url: fileUrl,
    uploadedAt: new Date().toISOString()
  };
}

function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * @route   POST /api/upload/single
 * @desc    Upload a single file
 */
router.post('/upload/single', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const maxMB = process.env.MAX_FILE_SIZE_MB || 200;
        return res.status(400).json({
          error: `File size exceeds limit of ${maxMB}MB.`
        });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided in the request.' });
    }

    const fileData = formatFileInfo(req, req.file);
    return res.status(201).json({
      message: 'File uploaded successfully!',
      file: fileData
    });
  });
});

/**
 * @route   POST /api/upload/multiple
 * @desc    Upload multiple files (up to 10)
 */
router.post('/upload/multiple', (req, res) => {
  upload.array('files', 10)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const maxMB = process.env.MAX_FILE_SIZE_MB || 200;
        return res.status(400).json({
          error: `One or more files exceed the size limit of ${maxMB}MB.`
        });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided in the request.' });
    }

    const uploadedFiles = req.files.map(file => formatFileInfo(req, file));
    return res.status(201).json({
      message: `${uploadedFiles.length} file(s) uploaded successfully!`,
      files: uploadedFiles
    });
  });
});

/**
 * @route   GET /api/uploads
 * @desc    Get list of all uploaded files
 */
router.get('/uploads', (req, res) => {
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read upload directory.' });
    }

    const host = process.env.HOST || `${req.protocol}://${req.get('host')}`;
    const fileList = files.map(filename => {
      const filePath = path.join(uploadDir, filename);
      let stats;
      try {
        stats = fs.statSync(filePath);
      } catch (e) {
        return null;
      }

      return {
        filename: filename,
        size: stats.size,
        sizeFormatted: formatBytes(stats.size),
        url: `${host}/uploads/${filename}`,
        createdAt: stats.birthtime
      };
    }).filter(Boolean);

    // Sort newest first
    fileList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({
      total: fileList.length,
      files: fileList
    });
  });
});

/**
 * @route   DELETE /api/upload/:filename
 * @desc    Delete an uploaded file from server
 */
router.delete('/upload/:filename', (req, res) => {
  const filename = path.basename(req.params.filename); // Sanitize path traversal
  const filePath = path.join(uploadDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found on server.' });
  }

  fs.unlink(filePath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete file.' });
    }
    return res.json({ message: `File '${filename}' deleted successfully.` });
  });
});

module.exports = router;
