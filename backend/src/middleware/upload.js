const multer = require('multer');
const path = require('path');
const fs = require('fs');
const env = require('../config/environment');

const useMemoryStorage = Boolean(process.env.VERCEL || env.BLOB_READ_WRITE_TOKEN);

if (!useMemoryStorage) {
  const uploadDir = path.join(process.cwd(), env.UPLOAD_PATH || 'uploads');
  const dirs = [
    path.join(uploadDir, 'deposit-slips'),
    path.join(uploadDir, 'bank-statements'),
    path.join(uploadDir, 'statements'),
    path.join(uploadDir, 'clearances'),
    path.join(uploadDir, 'profile-pictures'),
  ];
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subdir = 'deposit-slips';
    if (req.path.includes('bank')) subdir = 'bank-statements';
    if (req.path.includes('statement')) subdir = 'statements';
    if (req.path.includes('clearance')) subdir = 'clearances';
    if (req.path.includes('profile')) subdir = 'profile-pictures';
    const uploadDir = path.join(process.cwd(), env.UPLOAD_PATH || 'uploads');
    cb(null, path.join(uploadDir, subdir));
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + (path.extname(file.originalname) || '.bin'));
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /\.(pdf|csv|jpg|jpeg|png)$/i;
  if (allowed.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: PDF, CSV, JPG, PNG'));
  }
};

const upload = multer({
  storage: useMemoryStorage ? multer.memoryStorage() : diskStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = { upload };
