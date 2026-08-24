const logger = require('../utils/logger');

function normalizeBatchNumber(value) {
  let s = String(value || '')
    .toUpperCase()
    .replace(/[\s\-_]/g, '');
  s = s.replace(/^(BN|BATCH|TXN|REF|#)+/g, '');
  return s;
}

function amountsClose(a, b, tolerance = 1) {
  const x = parseFloat(a);
  const y = parseFloat(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return Math.abs(x - y) <= tolerance;
}

function toIsoDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const m = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function parseTransactionsFromPdfText(text) {
  const normalized = String(text || '')
    .replace(/(\d{4}-\d{2}-\d{2})/g, '\n$1 ')
    .replace(/(ABSA|ABS|ZANACO|ZNC|FNB)(\d{6,24})/gi, ' $1$2 ')
    .replace(/(ICU|STU)(\d{7})/gi, ' $1$2 ')
    .replace(/(\d{3,6}\.\d{2})/g, ' $1');

  const refRe = /\b(?:ABSA|ABS|ZANACO|ZNC|FNB)\d{6,24}\b/i;
  const dateRe = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/;
  const amountRe = /(?:K|ZMW)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[1-9][0-9]{2,5}(?:\.\d{2})?)/gi;

  const transactions = [];
  const seen = new Set();

  for (const line of normalized.split('\n')) {
    const raw = line.trim();
    if (!raw) continue;
    const ref = raw.match(refRe);
    if (!ref) continue;

    let amount = 0;
    for (const m of raw.matchAll(amountRe)) {
      const v = parseFloat(String(m[1] || m[0]).replace(/[,K\s]/gi, ''));
      if (v >= 50 && v <= 500000) amount = v;
    }
    if (amount <= 0) continue;

    const dateMatch = raw.match(dateRe);
    const batch = ref[0].toUpperCase();
    const depositor = raw
      .replace(refRe, ' ')
      .replace(dateRe, ' ')
      .replace(/\b(?:ICU|STU)\d{7}\b/gi, ' ')
      .replace(/(?:K|ZMW)?\s*[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const key = `${batch}-${amount}-${dateMatch ? dateMatch[0] : ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    transactions.push({
      batch_number: batch,
      amount,
      date: toIsoDate(dateMatch && dateMatch[0]),
      depositor_name: depositor,
    });
  }

  return transactions;
}

function looksLikeStudentIdAmount(amount) {
  const n = Math.round(parseFloat(amount));
  return Number.isFinite(n) && n >= 1_000_000 ? false : /^\d{7,10}$/.test(String(n));
}

function findBestBankMatch(payment, transactions) {
  const payBatch = normalizeBatchNumber(payment.batch_number);
  const payAmount = parseFloat(payment.amount);
  const studentNumber = String(payment.student_number || '').replace(/\D/g, '');

  const batchHits = payBatch
    ? transactions.filter((t) => normalizeBatchNumber(t.batch_number) === payBatch)
    : [];

  let best = null;
  let bestScore = 0;

  const candidates = batchHits.length ? batchHits : transactions;
  for (const txn of candidates) {
    const txnBatch = normalizeBatchNumber(txn.batch_number);
    let score = 0;

    if (payBatch && txnBatch && payBatch === txnBatch) {
      score += 70;
    }

    if (amountsClose(payAmount, txn.amount, 1)) {
      score += 25;
    } else if (amountsClose(payAmount, txn.amount, 50)) {
      score += 10;
    } else if (looksLikeStudentIdAmount(txn.amount) && payBatch && payBatch === txnBatch) {
      score += 15;
    }

    const depositor = String(txn.depositor_name || '');
    if (studentNumber && (depositor.includes(studentNumber) || String(txn.batch_number).includes(studentNumber))) {
      score += 10;
    }

    if (score > bestScore) {
      bestScore = score;
      best = txn;
    }
  }

  if (payBatch && batchHits.length === 1 && bestScore < 70) {
    best = batchHits[0];
    bestScore = 75;
  }

  if (!best || bestScore < 70) return null;
  return { transaction: best, confidence: Math.min(0.99, bestScore / 100) };
}

async function applyMatch(client, paymentId, match) {
  await client.query(
    `UPDATE student_payments
     SET status = 'auto_matched',
         matched_with_bank = true,
         matched_transaction_id = $1,
         match_confidence = $2,
         updated_at = NOW()
     WHERE payment_id = $3
       AND status IN ('pending', 'manual_review')`,
    [match.transaction.transaction_id, match.confidence, paymentId]
  );
  await client.query(
    `UPDATE bank_transactions
     SET matched_with_student = true, matched_payment_id = $1
     WHERE transaction_id = $2`,
    [paymentId, match.transaction.transaction_id]
  );
}

async function rematchPendingPayments(client, statementId = null) {
  const { rows: payments } = await client.query(
    `SELECT p.payment_id, p.batch_number, p.amount, p.payment_date, p.student_id,
            s.student_number
     FROM student_payments p
     JOIN students s ON s.student_id = p.student_id
     WHERE p.status IN ('pending', 'manual_review')
       AND COALESCE(p.matched_with_bank, false) = false`
  );

  const txnParams = statementId ? [statementId] : [];
  const txnSql = statementId
    ? `SELECT transaction_id, batch_number, amount, depositor_name, transaction_date
       FROM bank_transactions
       WHERE statement_id = $1
         AND COALESCE(matched_with_student, false) = false
         AND matched_payment_id IS NULL`
    : `SELECT transaction_id, batch_number, amount, depositor_name, transaction_date
       FROM bank_transactions
       WHERE COALESCE(matched_with_student, false) = false
         AND matched_payment_id IS NULL`;

  const { rows: transactions } = await client.query(txnSql, txnParams);

  let matchedCount = 0;
  const usedTxn = new Set();

  for (const payment of payments) {
    const available = transactions.filter((t) => !usedTxn.has(t.transaction_id));
    const match = findBestBankMatch(payment, available);
    if (!match) continue;
    await applyMatch(client, payment.payment_id, match);
    usedTxn.add(match.transaction.transaction_id);
    matchedCount += 1;
    logger.info('Auto-matched student payment to bank transaction', {
      payment_id: payment.payment_id,
      transaction_id: match.transaction.transaction_id,
      batch_number: payment.batch_number,
      confidence: match.confidence,
    });
  }

  return { matchedCount, pendingCount: payments.length, transactionCount: transactions.length };
}

module.exports = {
  normalizeBatchNumber,
  findBestBankMatch,
  rematchPendingPayments,
  parseTransactionsFromPdfText,
};
