const path = require('path');
const fs = require('fs');
const env = require('../config/environment');

const baseDir = path.join(process.cwd(), env.UPLOAD_PATH || 'uploads');

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

async function uploadToStorage(file, subdir) {
  if (!file) throw new Error('No file provided');
  const ext = path.extname(file.originalname) || '.bin';
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const filepath = getUploadPath(subdir, filename);
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  const buffer = file.buffer || (file.path && fs.readFileSync(file.path));
  if (!buffer) throw new Error('Could not read file');
  fs.writeFileSync(filepath, buffer);
  return getPublicUrl(subdir, filename);
}

module.exports = { getUploadPath, getPublicUrl, saveFile, uploadToStorage };
