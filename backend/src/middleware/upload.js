const multer = require('multer');
const path = require('path');
const fs = require('fs');
const env = require('../config/environment');

const useMemoryStorage = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

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
    const ext = path.extname(file.originalname || '').toLowerCase() || '.bin';
    cb(null, unique + ext);
  },
});

const MIME = {
  pdf: ['application/pdf'],
  csv: ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'],
  image: ['image/jpeg', 'image/jpg', 'image/png', 'image/pjpeg'],
};

function makeFilter(kinds) {
  const exts = new Set();
  const mimes = new Set();
  for (const kind of kinds) {
    if (kind === 'pdf') {
      exts.add('.pdf');
      MIME.pdf.forEach((m) => mimes.add(m));
    }
    if (kind === 'csv') {
      exts.add('.csv');
      MIME.csv.forEach((m) => mimes.add(m));
    }
    if (kind === 'image') {
      ['.jpg', '.jpeg', '.png'].forEach((e) => exts.add(e));
      MIME.image.forEach((m) => mimes.add(m));
    }
  }

  return (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    if (exts.has(ext) && (mimes.has(mime) || mime === 'application/octet-stream')) {
      return cb(null, true);
    }
    cb(new Error(`Invalid file type. Allowed: ${[...exts].join(', ')}`));
  };
}

function createUploader(kinds, maxSize = 10 * 1024 * 1024) {
  return multer({
    storage: useMemoryStorage ? multer.memoryStorage() : diskStorage,
    fileFilter: makeFilter(kinds),
    limits: { fileSize: maxSize },
  });
}

/** Default: documents + images (deposit slips, statements) */
const upload = createUploader(['pdf', 'csv', 'image']);
/** Profile pictures only */
const uploadImage = createUploader(['image'], 5 * 1024 * 1024);
/** Bank PDFs / CSV */
const uploadDocument = createUploader(['pdf', 'csv']);

module.exports = { upload, uploadImage, uploadDocument, createUploader };
