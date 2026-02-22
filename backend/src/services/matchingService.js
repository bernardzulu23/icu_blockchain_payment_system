const axios = require('axios');
const pdfParse = require('pdf-parse');
const env = require('../config/environment');
const logger = require('../utils/logger');

function parsePaymentsCsv(buffer) {
  const text = buffer.toString('utf-8');
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].toLowerCase().split(',').map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const row = {};
    headers.forEach((h, idx) => (row[h] = values[idx] || ''));
    const studentId = row.studentid || row.student_id || row['student id'] || '';
    const studentName = row.studentname || row.student_name || row['student name'] || '';
    const amount = parseFloat(row.amount || '0');
    const reference = row.reference || row.ref || '';
    if (studentId && amount) rows.push({ studentId, studentName, amount, reference });
  }
  return rows;
}

function extractBankRefsFromText(text) {
  const refs = new Map();
  const lines = text.split(/\n/);
  for (const line of lines) {
    const amounts = line.match(/\d+(?:\.\d{2})?/g) || [];
    const refsInLine = line.match(/[A-Z0-9]{6,20}/g) || [];
    for (const amt of amounts) {
      for (const ref of refsInLine) {
        if (ref.length >= 6) refs.set(amt, ref);
      }
    }
  }
  return refs;
}

async function runBatchMatching(paymentsBuffer, bankBuffer, bankMimeType) {
  const pythonUrl = env.PYTHON_SERVICE_URL;
  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('payments', paymentsBuffer, { filename: 'payments.csv', contentType: 'text/csv' });
    form.append('bankStatement', bankBuffer, {
      filename: 'bank.pdf',
      contentType: bankMimeType || 'application/pdf',
    });
    const res = await axios.post(`${pythonUrl}/batch/match`, form, {
      headers: form.getHeaders(),
      timeout: 60000,
    });
    return res.data;
  } catch (err) {
    logger.warn('Python service unavailable, using fallback matching');
  }

  const payments = parsePaymentsCsv(paymentsBuffer);
  let bankText = '';
  if (bankMimeType === 'application/pdf') {
    const data = await pdfParse(bankBuffer);
    bankText = data.text;
  } else {
    bankText = bankBuffer.toString('utf-8');
  }
  const bankRefs = extractBankRefsFromText(bankText);

  const seen = new Set();
  const results = [];
  let matched = 0;
  let unmatched = 0;
  let duplicates = 0;

  for (const p of payments) {
    const key = `${p.studentId}-${p.amount}-${p.reference}`;
    if (seen.has(key)) {
      duplicates++;
      results.push({ ...p, status: 'duplicate' });
      continue;
    }
    seen.add(key);
    const amountStr = String(p.amount);
    const found =
      bankText.includes(p.reference) || bankText.includes(amountStr) || bankRefs.has(amountStr);
    if (found) {
      matched++;
      results.push({ ...p, status: 'matched' });
    } else {
      unmatched++;
      results.push({ ...p, status: 'unmatched' });
    }
  }

  return {
    totalProcessed: payments.length,
    matched,
    unmatched,
    duplicates,
    results,
  };
}

module.exports = { runBatchMatching, parsePaymentsCsv };
