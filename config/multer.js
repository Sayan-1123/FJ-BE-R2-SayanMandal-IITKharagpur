/**
 * Multer Configuration
 * Handles file uploads for receipts and bank statements
 */
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Ensure upload directories exist
const dirs = ['uploads/receipts', 'uploads/statements'];
dirs.forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Receipt storage
const receiptStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/receipts'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `receipt-${uuidv4()}${ext}`);
  },
});

// Bank statement storage
const statementStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/statements'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `statement-${uuidv4()}${ext}`);
  },
});

const receiptFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|pdf|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) return cb(null, true);
  cb(new Error('Only image and PDF files are allowed for receipts'));
};

const statementFilter = (req, file, cb) => {
  const allowed = /csv|pdf/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  if (ext) return cb(null, true);
  cb(new Error('Only CSV and PDF files are allowed for statements'));
};

const uploadReceipt = multer({
  storage: receiptStorage,
  fileFilter: receiptFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const uploadStatement = multer({
  storage: statementStorage,
  fileFilter: statementFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

module.exports = { uploadReceipt, uploadStatement };
