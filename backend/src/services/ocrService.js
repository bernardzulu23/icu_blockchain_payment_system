const axios = require('axios');
const FormData = require('form-data');
const env = require('../config/environment');
const logger = require('../utils/logger');

const OCR_CONFIDENCE_THRESHOLD = parseFloat(process.env.OCR_CONFIDENCE_THRESHOLD || '0.65');

/**
 * OCR is implemented in the Python microservice (pytesseract + OpenCV preprocessing).
 * Node acts as orchestrator — avoids duplicate Tesseract native bindings on VPS.
 */
async function ocrDepositSlip(imageBuffer, filename = 'slip.png', bankHint = '') {
  const base = env.PYTHON_SERVICE_URL;
  if (!base) throw new Error('PYTHON_SERVICE_URL not configured — OCR unavailable');

  const form = new FormData();
  form.append('slip', imageBuffer, { filename, contentType: 'image/png' });
  if (bankHint) form.append('bank', bankHint);

  const res = await axios.post(`${base}/ocr/deposit-slip`, form, {
    headers: form.getHeaders(),
    timeout: 120000,
  });
  return res.data?.result || res.data;
}

async function ocrDepositSlips(files, bankHint = '') {
  const base = env.PYTHON_SERVICE_URL;
  if (!base) throw new Error('PYTHON_SERVICE_URL not configured — OCR unavailable');

  const form = new FormData();
  for (const f of files) {
    form.append('slips', f.buffer, { filename: f.originalname, contentType: f.mimetype });
  }
  if (bankHint) form.append('bank', bankHint);

  const res = await axios.post(`${base}/ocr/deposit-slips`, form, {
    headers: form.getHeaders(),
    timeout: 300000,
  });
  return res.data;
}

async function ocrReconcileBatch({ bankBuffer, bankFilename, bankMime, slipFiles, bankHint = '' }) {
  const base = env.PYTHON_SERVICE_URL;
  if (!base) throw new Error('PYTHON_SERVICE_URL not configured — OCR unavailable');

  const form = new FormData();
  form.append('bankStatement', bankBuffer, {
    filename: bankFilename || 'statement.pdf',
    contentType: bankMime || 'application/pdf',
  });
  for (const f of slipFiles) {
    form.append('slips', f.buffer, { filename: f.originalname, contentType: f.mimetype });
  }
  if (bankHint) form.append('bank', bankHint);

  const started = Date.now();
  const res = await axios.post(`${base}/ocr/reconcile`, form, {
    headers: form.getHeaders(),
    timeout: 600000,
  });
  const nodeOverheadMs = Date.now() - started - (res.data?.processing_ms || 0);

  return {
    ...res.data,
    node_overhead_ms: nodeOverheadMs,
    confidence_threshold: OCR_CONFIDENCE_THRESHOLD,
  };
}

module.exports = {
  ocrDepositSlip,
  ocrDepositSlips,
  ocrReconcileBatch,
  OCR_CONFIDENCE_THRESHOLD,
};
