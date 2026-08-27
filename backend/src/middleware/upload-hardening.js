/**
 * ICU Pay — Deposit-Slip & Bank-Statement Upload Hardening
 * Extension → MIME → magic bytes → size limit → random filename → private storage.
 *
 * npm i multer file-type
 */
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const env = require('../config/environment');
const { sanitizeMetadataString } = require('../utils/input-validation');

const MAX_DEPOSIT_SLIP_BYTES = 5 * 1024 * 1024;
const MAX_BANK_STATEMENT_BYTES = 10 * 1024 * 1024;

const DEPOSIT_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const DEPOSIT_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.pdf']);

const BANK_MIME_TYPES = new Set([
  'application/pdf',
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'text/plain',
]);
const BANK_EXTENSIONS = new Set(['.pdf', '.csv']);

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

function multerFilter(allowedExtensions, allowedMimeTypes) {
  return (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    if (!allowedExtensions.has(ext) || !allowedMimeTypes.has(mime)) {
      return cb(new Error('Unsupported file type.'));
    }
    return cb(null, true);
  };
}

const depositSlipUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DEPOSIT_SLIP_BYTES, files: 1 },
  fileFilter: multerFilter(DEPOSIT_EXTENSIONS, DEPOSIT_MIME_TYPES),
});

const bankStatementUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BANK_STATEMENT_BYTES, files: 1 },
  fileFilter: multerFilter(BANK_EXTENSIONS, BANK_MIME_TYPES),
});

const batchSlipsUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DEPOSIT_SLIP_BYTES, files: 50 },
  fileFilter: multerFilter(DEPOSIT_EXTENSIONS, DEPOSIT_MIME_TYPES),
});

async function detectFileType(buffer) {
  const { fileTypeFromBuffer } = await import('file-type');
  return fileTypeFromBuffer(buffer);
}

function validateCsvBuffer(buffer) {
  if (!buffer?.length) throw new Error('Empty file.');
  if (buffer.includes(0)) throw new Error('File content does not match an allowed type.');
  const sample = buffer.slice(0, 8192).toString('utf8');
  if (!/^[\t\n\r\x20-\x7e]*$/.test(sample)) {
    throw new Error('File content does not match an allowed type.');
  }
  return { mime: 'text/csv', ext: 'csv' };
}

async function validateDepositSlipContents(buffer) {
  const detected = await detectFileType(buffer);
  if (!detected || !DEPOSIT_MIME_TYPES.has(detected.mime)) {
    throw new Error('File content does not match an allowed type.');
  }
  return detected;
}

async function validateBankStatementContents(buffer, originalName = '') {
  const ext = path.extname(originalName).toLowerCase();
  if (ext === '.csv') {
    return validateCsvBuffer(buffer);
  }
  const detected = await detectFileType(buffer);
  if (!detected || detected.mime !== 'application/pdf') {
    throw new Error('File content does not match an allowed type.');
  }
  return detected;
}

function generateSafeFilename(detectedExt) {
  const randomName = crypto.randomBytes(24).toString('hex');
  return `${randomName}.${detectedExt}`;
}

function buildUploadedFileMeta(file, detected) {
  const contentHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
  return {
    buffer: file.buffer,
    storedName: generateSafeFilename(detected.ext),
    originalName: sanitizeMetadataString(file.originalname || 'upload', 255),
    mimeType: detected.mime,
    sizeBytes: file.size,
    contentHash,
  };
}

async function scanForMalware(buffer) {
  // TODO: ClamAV or cloud AV before production — documented residual risk if not integrated.
  return { clean: true, scanned: false };
}

async function processUploadFile(file, kind) {
  if (!file?.buffer) throw new Error('No file was uploaded.');
  const validate =
    kind === 'bank' ? validateBankStatementContents : validateDepositSlipContents;
  const detected = await validate(file.buffer, file.originalname);
  const scan = await scanForMalware(file.buffer);
  if (!scan.clean) throw new Error('File failed malware scan.');
  return buildUploadedFileMeta(file, detected);
}

async function handleDepositSlipUpload(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file was uploaded.' });
    }
    req.uploadedFile = await processUploadFile(req.file, 'deposit');
    return next();
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Upload validation failed.' });
  }
}

async function handleBankStatementUpload(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file was uploaded.' });
    }
    req.uploadedFile = await processUploadFile(req.file, 'bank');
    return next();
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Upload validation failed.' });
  }
}

/** Validate multi-file batch uploads (req.files.slips or req.files[field]). */
function handleBatchDepositSlips(fieldNames = ['slips', 'payments']) {
  return async (req, res, next) => {
    try {
      const collected = [];
      if (req.files && typeof req.files === 'object') {
        for (const name of fieldNames) {
          const chunk = req.files[name];
          if (Array.isArray(chunk)) collected.push(...chunk);
        }
      }
      if (!collected.length) {
        return res.status(400).json({ error: 'At least one deposit slip is required.' });
      }
      req.uploadedFiles = [];
      for (const file of collected) {
        req.uploadedFiles.push(await processUploadFile(file, 'deposit'));
      }
      return next();
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Upload validation failed.' });
    }
  };
}

/** Bank statement + multiple deposit slips (batch OCR reconcile). */
async function handleBatchReconcileUploads(req, res, next) {
  try {
    const bankFile = req.files?.bankStatement?.[0];
    const slipFiles = req.files?.slips || [];
    if (!bankFile) {
      return res.status(400).json({ error: 'Bank statement file is required.' });
    }
    if (!slipFiles.length) {
      return res.status(400).json({ error: 'At least one deposit slip is required.' });
    }
    req.uploadedFile = await processUploadFile(bankFile, 'bank');
    req.uploadedFiles = [];
    for (const file of slipFiles) {
      req.uploadedFiles.push(await processUploadFile(file, 'deposit'));
    }
    return next();
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Upload validation failed.' });
  }
}

module.exports = {
  depositSlipUpload,
  bankStatementUpload,
  batchSlipsUpload,
  handleDepositSlipUpload,
  handleBankStatementUpload,
  handleBatchDepositSlips,
  handleBatchReconcileUploads,
  validateDepositSlipContents,
  validateBankStatementContents,
  generateSafeFilename,
  scanForMalware,
  MAX_DEPOSIT_SLIP_BYTES,
  MAX_BANK_STATEMENT_BYTES,
  isServerless,
};
