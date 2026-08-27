const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const env = require('../config/environment');
const logger = require('../utils/logger');

const configuredUpload = env.UPLOAD_PATH || 'uploads';
const baseDir = path.isAbsolute(configuredUpload)
  ? configuredUpload
  : path.resolve(process.cwd(), configuredUpload);
const BUCKET = env.SUPABASE_STORAGE_BUCKET || 'icu-uploads';

let supabase = null;
/** After a TLS/network failure, skip Supabase for this process lifetime */
let supabaseStorageDisabled = false;

function getSupabase() {
  if (supabaseStorageDisabled) return null;
  if (supabase) return supabase;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabase;
}

function useSupabaseStorage() {
  if (supabaseStorageDisabled) return false;
  if (process.env.SUPABASE_STORAGE_ENABLED === 'false') return false;
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function isRemoteUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function isSupabaseRef(value) {
  return typeof value === 'string' && value.startsWith('sb:');
}

function parseSupabaseRef(ref) {
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

function formatStorageError(error) {
  if (!error) return 'unknown error';
  if (typeof error === 'string') return error;
  const parts = [error.message, error.error, error.statusCode, error.name].filter(Boolean);
  const cause = error.originalError?.cause?.message || error.originalError?.message;
  if (cause) parts.push(cause);
  return parts.join(' — ') || JSON.stringify(error);
}

function isTlsOrNetworkError(error) {
  const msg = formatStorageError(error).toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('unable to verify') ||
    msg.includes('certificate') ||
    msg.includes('enotfound') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('network')
  );
}

async function ensureBucket() {
  const client = getSupabase();
  if (!client) return;
  try {
    const { data: buckets, error } = await client.storage.listBuckets();
    if (error) {
      logger.warn('Could not list Supabase buckets:', formatStorageError(error));
      if (isTlsOrNetworkError(error)) {
        supabaseStorageDisabled = true;
        logger.warn('Supabase Storage disabled for this process — using local uploads/');
      }
      return;
    }
    if (!buckets?.some((b) => b.name === BUCKET)) {
      const { error: createErr } = await client.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024,
      });
      if (createErr && !/already exists/i.test(createErr.message || '')) {
        logger.warn('Could not create Supabase bucket:', formatStorageError(createErr));
      } else {
        logger.info(`Supabase storage bucket ready: ${BUCKET}`);
      }
    }
  } catch (err) {
    logger.warn('ensureBucket failed:', formatStorageError(err));
    if (isTlsOrNetworkError(err)) {
      supabaseStorageDisabled = true;
    }
  }
}

function saveLocally(file, subdir) {
  const ext = path.extname(file.originalname || '') || '.bin';
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const filepath = getUploadPath(subdir, filename);
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  const buffer = file.buffer || (file.path && fs.readFileSync(file.path));
  if (!buffer) throw new Error('Could not read file');
  fs.writeFileSync(filepath, buffer);
  return getPublicUrl(subdir, filename);
}

async function uploadToSupabase(file, subdir, storedName) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase storage is not configured');

  await ensureBucket();
  if (supabaseStorageDisabled) {
    throw new Error('Supabase Storage unavailable (TLS/network)');
  }

  const ext = path.extname(file.originalname || '') || '.bin';
  const filename = storedName || `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const objectPath = `${subdir}/${filename}`;
  const buffer = file.buffer || (file.path && fs.readFileSync(file.path));
  if (!buffer) throw new Error('Could not read file');

  const { error } = await client.storage.from(BUCKET).upload(objectPath, buffer, {
    contentType: file.mimetype || 'application/octet-stream',
    upsert: false,
  });

  if (error) {
    const detail = formatStorageError(error);
    logger.error('Supabase upload failed:', detail);
    if (isTlsOrNetworkError(error)) {
      supabaseStorageDisabled = true;
    }
    const err = new Error(detail);
    err.cause = error;
    throw err;
  }

  return `sb:${BUCKET}/${objectPath}`;
}

function saveLocallyWithName(buffer, subdir, filename, mimeType) {
  const filepath = getUploadPath(subdir, filename);
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, buffer);
  return getPublicUrl(subdir, filename);
}

/**
 * Persist a validated upload from upload-hardening (opaque filename + content hash).
 */
async function uploadHardenedFile(uploadedFile, subdir) {
  if (!uploadedFile?.buffer || !uploadedFile.storedName) {
    throw new Error('Invalid hardened upload payload');
  }

  const pseudoFile = {
    buffer: uploadedFile.buffer,
    mimetype: uploadedFile.mimeType,
    originalname: uploadedFile.originalName,
  };

  if (useSupabaseStorage()) {
    try {
      return await uploadToSupabase(pseudoFile, subdir, uploadedFile.storedName);
    } catch (err) {
      logger.warn(
        'Supabase upload failed; saving to local uploads/ instead:',
        formatStorageError(err)
      );
      return saveLocallyWithName(
        uploadedFile.buffer,
        subdir,
        uploadedFile.storedName,
        uploadedFile.mimeType
      );
    }
  }

  return saveLocallyWithName(
    uploadedFile.buffer,
    subdir,
    uploadedFile.storedName,
    uploadedFile.mimeType
  );
}

async function uploadToStorage(file, subdir) {
  if (!file) throw new Error('No file provided');

  if (useSupabaseStorage()) {
    try {
      return await uploadToSupabase(file, subdir);
    } catch (err) {
      logger.warn(
        'Supabase upload failed; saving to local uploads/ instead:',
        formatStorageError(err)
      );
      return saveLocally(file, subdir);
    }
  }

  return saveLocally(file, subdir);
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
    const response = await axios.get(urlOrPath, { responseType: 'arraybuffer', timeout: 60000 });
    return Buffer.from(response.data);
  }

  // '/uploads/...' is an app URL, not a Windows absolute path (path.isAbsolute('/x') is true on win32)
  const normalized = String(urlOrPath).replace(/\\/g, '/');
  const isUploadUrl = /^\/?uploads\//i.test(normalized);
  const fullPath = isUploadUrl || !path.isAbsolute(urlOrPath)
    ? resolveLocalUploadPath(urlOrPath)
    : assertPathInsideUploads(urlOrPath);

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
  uploadHardenedFile,
  readStoredFile,
  isRemoteUrl,
  isSupabaseRef,
  resolveLocalUploadPath,
  assertPathInsideUploads,
  ensureBucket,
  useSupabaseStorage,
  baseDir,
};
