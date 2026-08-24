const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const env = require('../config/environment');

const OCR_CONFIDENCE_THRESHOLD = parseFloat(process.env.OCR_CONFIDENCE_THRESHOLD || '0.65');

function pythonUnavailableError(extra = '') {
  const err = new Error(
    `Python OCR service is not running. From the project root run: npm run dev:python${extra}`
  );
  err.statusCode = 503;
  return err;
}

function wrapPythonError(err) {
  const code = err.code;
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ECONNRESET') {
    return pythonUnavailableError('');
  }
  if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') {
    const timeout = new Error('OCR timed out. Try fewer slips or a smaller bank PDF.');
    timeout.statusCode = 504;
    return timeout;
  }
  const data = err.response?.data;
  let detail = err.message;
  if (data && typeof data === 'object') {
    detail = data.error || data.message || detail;
  } else if (typeof data === 'string' && data.length < 400) {
    detail = data;
  }
  const wrapped = new Error(detail || 'OCR service request failed');
  wrapped.statusCode =
    err.response?.status && err.response.status >= 400 ? err.response.status : 502;
  return wrapped;
}

function multerFileBuffer(file) {
  if (file?.buffer?.length) return file.buffer;
  if (file?.path && fs.existsSync(file.path)) return fs.readFileSync(file.path);
  throw new Error(`Missing file data for ${file?.originalname || 'upload'}`);
}

/**
 * OCR is implemented in the Python microservice (pytesseract + OpenCV preprocessing).
 * Node acts as orchestrator — avoids duplicate Tesseract native bindings on VPS.
 */
async function ocrDepositSlip(imageBuffer, filename = 'slip.png', bankHint = '') {
  const base = env.PYTHON_SERVICE_URL;
  if (!base) throw pythonUnavailableError(' (and set PYTHON_SERVICE_URL)');

  const form = new FormData();
  form.append('slip', imageBuffer, { filename, contentType: 'image/png' });
  if (bankHint) form.append('bank', bankHint);

  try {
    const res = await axios.post(`${base}/ocr/deposit-slip`, form, {
      headers: form.getHeaders(),
      timeout: 120000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    return res.data?.result || res.data;
  } catch (err) {
    throw wrapPythonError(err);
  }
}

async function ocrDepositSlips(files, bankHint = '') {
  const base = env.PYTHON_SERVICE_URL;
  if (!base) throw pythonUnavailableError(' (and set PYTHON_SERVICE_URL)');

  const form = new FormData();
  for (const f of files) {
    form.append('slips', multerFileBuffer(f), {
      filename: f.originalname,
      contentType: f.mimetype,
    });
  }
  if (bankHint) form.append('bank', bankHint);

  try {
    const res = await axios.post(`${base}/ocr/deposit-slips`, form, {
      headers: form.getHeaders(),
      timeout: 300000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    return res.data;
  } catch (err) {
    throw wrapPythonError(err);
  }
}

async function ocrReconcileBatch({ bankBuffer, bankFilename, bankMime, slipFiles, bankHint = '' }) {
  const base = env.PYTHON_SERVICE_URL;
  if (!base) throw pythonUnavailableError(' (and set PYTHON_SERVICE_URL)');

  const form = new FormData();
  form.append('bankStatement', bankBuffer, {
    filename: bankFilename || 'statement.pdf',
    contentType: bankMime || 'application/pdf',
  });
  for (const f of slipFiles) {
    form.append('slips', multerFileBuffer(f), {
      filename: f.originalname,
      contentType: f.mimetype,
    });
  }
  if (bankHint) form.append('bank', bankHint);

  const started = Date.now();
  try {
    const res = await axios.post(`${base}/ocr/reconcile`, form, {
      headers: form.getHeaders(),
      timeout: 600000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    const nodeOverheadMs = Date.now() - started - (res.data?.processing_ms || 0);

    return {
      ...res.data,
      node_overhead_ms: nodeOverheadMs,
      confidence_threshold: OCR_CONFIDENCE_THRESHOLD,
    };
  } catch (err) {
    throw wrapPythonError(err);
  }
}

module.exports = {
  ocrDepositSlip,
  ocrDepositSlips,
  ocrReconcileBatch,
  multerFileBuffer,
  OCR_CONFIDENCE_THRESHOLD,
};
