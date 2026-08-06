const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Disk storage engine configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique random string + timestamp
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    
    // Sanitize original filename (keep basename without extension, replace special chars)
    const baseName = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50); // limit length

    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});

// Calculate file size limit in bytes (Default: 200MB)
const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 200;
const limits = {
  fileSize: maxFileSizeMB * 1024 * 1024
};

// Optional file filter (allows all files by default, but can be restricted if needed)
const fileFilter = (req, file, cb) => {
  // Allow all standard mime types
  cb(null, true);
};

const upload = multer({
  storage: storage,
  limits: limits,
  fileFilter: fileFilter
});

module.exports = { upload, uploadDir };
