const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const env = require('../config/environment');
const logger = require('../utils/logger');

const baseDir = path.resolve(process.cwd(), env.UPLOAD_PATH || 'uploads');
const BUCKET = env.SUPABASE_STORAGE_BUCKET || 'icu-uploads';

let supabase = null;

function getSupabase() {
  if (supabase) return supabase;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabase;
}

function useSupabaseStorage() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function isRemoteUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function isSupabaseRef(value) {
  return typeof value === 'string' && value.startsWith('sb:');
}

function parseSupabaseRef(ref) {
  // sb:bucket/path/to/file.ext
  const rest = ref.slice(3);
  const slash = rest.indexOf('/');
  if (slash < 0) throw new Error('Invalid Supabase storage ref');
  return { bucket: rest.slice(0, slash), objectPath: rest.slice(slash + 1) };
}

function getUploadPath(subdir, filename) {
  const dir = path.join(baseDir, subdir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, filename);
}

function getPublicUrl(subdir, filename) {
  return `/uploads/${subdir}/${filename}`;
}

function assertPathInsideUploads(fullPath) {
  const resolved = path.resolve(fullPath);
  const root = baseDir.endsWith(path.sep) ? baseDir : baseDir + path.sep;
  if (resolved !== baseDir && !resolved.startsWith(root)) {
    throw new Error('Invalid file path');
  }
  return resolved;
}

function resolveLocalUploadPath(urlOrPath) {
  let relative = String(urlOrPath).replace(/\\/g, '/');
  if (relative.startsWith('/uploads/')) {
    relative = relative.slice('/uploads/'.length);
  } else if (relative.startsWith('uploads/')) {
    relative = relative.slice('uploads/'.length);
  } else {
    relative = relative.replace(/^\//, '');
  }
  if (relative.includes('..')) {
    throw new Error('Invalid file path');
  }
  return assertPathInsideUploads(path.join(baseDir, relative));
}

function saveFile(buffer, subdir, filename) {
  const filepath = getUploadPath(subdir, filename);
  fs.writeFileSync(filepath, buffer);
  return getPublicUrl(subdir, filename);
}

async function ensureBucket() {
  const client = getSupabase();
  if (!client) return;
  const { data: buckets, error } = await client.storage.listBuckets();
  if (error) {
    logger.warn('Could not list Supabase buckets:', error.message);
    return;
  }
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error: createErr } = await client.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
    });
    if (createErr && !/already exists/i.test(createErr.message)) {
      logger.warn('Could not create Supabase bucket:', createErr.message);
    } else {
      logger.info(`Supabase storage bucket ready: ${BUCKET}`);
    }
  }
}

async function uploadToSupabase(file, subdir) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase storage is not configured');

  await ensureBucket();

  const ext = path.extname(file.originalname) || '.bin';
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const objectPath = `${subdir}/${filename}`;
  const buffer = file.buffer || (file.path && fs.readFileSync(file.path));
  if (!buffer) throw new Error('Could not read file');

  const { error } = await client.storage.from(BUCKET).upload(objectPath, buffer, {
    contentType: file.mimetype || 'application/octet-stream',
    upsert: false,
  });

  if (error) {
    logger.error('Supabase upload failed:', error.message);
    throw new Error('File upload failed');
  }

  return `sb:${BUCKET}/${objectPath}`;
}

async function uploadToStorage(file, subdir) {
  if (!file) throw new Error('No file provided');

  if (useSupabaseStorage()) {
    return uploadToSupabase(file, subdir);
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

  if (isSupabaseRef(urlOrPath)) {
    const client = getSupabase();
    if (!client) throw new Error('Supabase storage is not configured');
    const { bucket, objectPath } = parseSupabaseRef(urlOrPath);
    const { data, error } = await client.storage.from(bucket).download(objectPath);
    if (error || !data) {
      throw new Error('File not found');
    }
    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
  }

  if (isRemoteUrl(urlOrPath)) {
    // Legacy public HTTP URLs
    const response = await axios.get(urlOrPath, { responseType: 'arraybuffer', timeout: 60000 });
    return Buffer.from(response.data);
  }

  const fullPath = path.isAbsolute(urlOrPath)
    ? assertPathInsideUploads(urlOrPath)
    : resolveLocalUploadPath(urlOrPath);

  if (!fs.existsSync(fullPath)) {
    throw new Error('File not found');
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
  isSupabaseRef,
  resolveLocalUploadPath,
  assertPathInsideUploads,
  ensureBucket,
  useSupabaseStorage,
  baseDir,
};
