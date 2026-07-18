const path = require('path');
const fs = require('fs');
const axios = require('axios');
const env = require('../config/environment');

const baseDir = path.join(process.cwd(), env.UPLOAD_PATH || 'uploads');

function isRemoteUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function getUploadPath(subdir, filename) {
  const dir = path.join(baseDir, subdir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, filename);
}

function getPublicUrl(subdir, filename) {
  return `/uploads/${subdir}/${filename}`;
}

function saveFile(buffer, subdir, filename) {
  const filepath = getUploadPath(subdir, filename);
  fs.writeFileSync(filepath, buffer);
  return getPublicUrl(subdir, filename);
}

async function uploadToBlob(file, subdir) {
  const { put } = await import('@vercel/blob');
  const ext = path.extname(file.originalname) || '.bin';
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const buffer = file.buffer || (file.path && fs.readFileSync(file.path));
  if (!buffer) throw new Error('Could not read file');

  const blob = await put(`${subdir}/${filename}`, buffer, {
    access: 'public',
    token: env.BLOB_READ_WRITE_TOKEN,
    contentType: file.mimetype,
  });
  return blob.url;
}

async function uploadToStorage(file, subdir) {
  if (!file) throw new Error('No file provided');

  if (env.BLOB_READ_WRITE_TOKEN) {
    return uploadToBlob(file, subdir);
  }

  const ext = path.extname(file.originalname) || '.bin';
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const filepath = getUploadPath(subdir, filename);
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  const buffer = file.buffer || (file.path && fs.readFileSync(file.path));
  if (!buffer) throw new Error('Could not read file');
  fs.writeFileSync(filepath, buffer);
  return getPublicUrl(subdir, filename);
}

async function readStoredFile(urlOrPath) {
  if (!urlOrPath) throw new Error('No file path provided');

  if (isRemoteUrl(urlOrPath)) {
    const response = await axios.get(urlOrPath, { responseType: 'arraybuffer', timeout: 60000 });
    return Buffer.from(response.data);
  }

  const fullPath = path.isAbsolute(urlOrPath)
    ? urlOrPath
    : path.join(process.cwd(), urlOrPath.replace(/^\//, ''));

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }
  return fs.readFileSync(fullPath);
}

module.exports = {
  getUploadPath,
  getPublicUrl,
  saveFile,
  uploadToStorage,
  readStoredFile,
  isRemoteUrl,
};
