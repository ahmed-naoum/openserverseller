const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const uploadRoutes = require('./routes/uploadRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

// Middlewares
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploaded files
const uploadPath = path.join(__dirname, UPLOAD_DIR);
app.use('/uploads', express.static(uploadPath));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', uploadRoutes);

// Root route fallback to frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 Upload Server running at: http://localhost:${PORT}`);
  console.log(`📁 Files served static at:  http://localhost:${PORT}/uploads`);
  console.log(`⚙️  Max File Size Limit:     ${process.env.MAX_FILE_SIZE_MB || 200} MB`);
  console.log(`=================================================`);
});
