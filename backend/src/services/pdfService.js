const PDFDocument = require('pdfkit');
const { PDFDocument: PDFLib, StandardFonts } = require('pdf-lib-with-encrypt');
const path = require('path');
const fs = require('fs');
const env = require('../config/environment');

function generateReceiptPdf(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('ICU Payment Receipt', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Student: ${data.studentName} (${data.studentId})`);
    doc.text(`Amount: ${data.amount.toLocaleString()} ZMW`);
    doc.text(`Reference: ${data.reference}`);
    doc.text(`Date: ${data.date}`);
    if (data.txHash) doc.text(`Blockchain: ${data.txHash}`);
    doc.end();
  });
}

async function saveReceiptPdf(data, filename) {
  const buffer = await generateReceiptPdf(data);
  const dir = path.join(process.cwd(), env.UPLOAD_PATH, 'statements');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, buffer);
  return `/uploads/statements/${filename}`;
}

async function generateStatementPDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const dir = path.join(process.cwd(), env.UPLOAD_PATH, 'statements');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `statement-${data.student_number}-${data.semester}-${Date.now()}.pdf`;
    const filepath = path.join(dir, filename);
    const stream = fs.createWriteStream(filepath);

    doc.pipe(stream);
    doc.fontSize(20).text('ICU Payment Statement', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`Student: ${data.student_name} (${data.student_number})`);
    doc.text(`Semester: ${data.semester}, ${data.academic_year}`);
    doc.text(`Amount: K${parseFloat(data.amount).toFixed(2)}`);
    doc.text(`Batch: ${data.batch_number}`);
    doc.text(`Bank: ${data.bank_name || 'N/A'}`);
    doc.text(`Payment Date: ${data.payment_date}`);
    doc.text(`Verified By: ${data.verified_by}`);
    doc.text(`Verified Date: ${data.verified_date?.toISOString?.() || new Date().toISOString()}`);
    if (data.blockchain_tx_id) doc.text(`Blockchain TX: ${data.blockchain_tx_id}`);
    doc.end();

    stream.on('finish', () => resolve(`/uploads/statements/${filename}`));
    stream.on('error', reject);
    doc.on('error', reject);
  });
}

async function generateStatement(data) {
  return generateStatementPDF(data);
}

/**
 * Generate a password-protected "Proof of No Balance at ICU" PDF.
 * @param {Object} opts - { student_number, student_name, payments: Array<{ semester, academic_year, amount, payment_date, verified_date?, batch_number }> }
 * @returns {Promise<string>} URL path to the saved PDF (e.g. /uploads/statements/proof-...)
 */
async function generateProofOfNoBalancePDF(opts) {
  const { student_number, student_name, payments } = opts;
  const password = String(student_number || '');

  const doc = await PDFLib.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  const title = 'Proof of No Balance at ICU';
  page.drawText(title, {
    font: fontBold,
    size: 18,
    x: margin,
    y,
  });
  y -= 28;

  page.drawText(`Student: ${student_name || 'N/A'}`, { font, size: 12, x: margin, y });
  y -= 18;
  page.drawText(`Student Number: ${student_number || 'N/A'}`, { font, size: 12, x: margin, y });
  y -= 24;

  page.drawText('Verified payment records:', { font: fontBold, size: 12, x: margin, y });
  y -= 18;

  let currentPage = page;
  for (const p of payments || []) {
    const line =
      `${p.semester} ${p.academic_year} – K${parseFloat(p.amount || 0).toFixed(2)} – Batch: ${p.batch_number || 'N/A'} – ${(p.payment_date || '').toString().slice(0, 10)}`;
    if (y < margin + 40) {
      currentPage = doc.addPage([595, 842]);
      y = currentPage.getHeight() - margin;
    }
    currentPage.drawText(line, { font, size: 10, x: margin, y });
    y -= 14;
  }

  y -= 20;
  const certDate = new Date().toISOString().split('T')[0];
  const cert =
    `This certifies that the above student has no outstanding balance at ICU as at ${certDate}. This document is issued as proof of payment record.`;
  const certLines = cert.match(/.{1,70}(\s|$)/g) || [cert];
  for (const line of certLines) {
    if (y < margin + 20) {
      currentPage = doc.addPage([595, 842]);
      y = currentPage.getHeight() - margin;
    }
    currentPage.drawText(line.trim(), { font, size: 10, x: margin, y });
    y -= 14;
  }

  if (password) {
    await doc.encrypt({ userPassword: password });
  }

  const dir = path.join(process.cwd(), env.UPLOAD_PATH, 'statements');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `proof-no-balance-${student_number}-${Date.now()}.pdf`;
  const filepath = path.join(dir, filename);
  const pdfBytes = await doc.save();
  fs.writeFileSync(filepath, Buffer.from(pdfBytes));
  return `/uploads/statements/${filename}`;
}

/**
 * Generate "Certification of Completion of Payment" PDF with three signature blocks.
 * @param {Object} opts - { student_number, student_name, program, payments[], accountant_signer, admin_signer, registrar_signer }
 * @param {string} opts.accountant_signer - full_name for Accounts Staff
 * @param {string} opts.admin_signer - full_name for Admin Officer
 * @param {string} opts.registrar_signer - full_name for Registrar
 * @returns {Promise<string>} URL path to the saved PDF
 */
async function generatePaymentCompletionCertificatePDF(opts) {
  const {
    student_number,
    student_name,
    program,
    payments = [],
    accountant_signer = '',
    admin_signer = '',
    registrar_signer = '',
  } = opts;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const dir = path.join(process.cwd(), env.UPLOAD_PATH, 'statements');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `certificate-completion-${student_number}-${Date.now()}.pdf`;
    const filepath = path.join(dir, filename);
    const stream = fs.createWriteStream(filepath);

    doc.pipe(stream);

    doc.fontSize(22).text('CERTIFICATION OF COMPLETION OF PAYMENT', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text('International Christian University', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(12);
    doc.text(`Student Name: ${student_name || 'N/A'}`);
    doc.text(`Student Number: ${student_number || 'N/A'}`);
    doc.text(`Program: ${program || 'N/A'}`);
    doc.moveDown();

    doc.fontSize(11).text('Verified Payment Records:', { continued: false });
    doc.moveDown(0.5);
    for (const p of payments) {
      doc.fontSize(10).text(
        `  • Semester ${p.semester} ${p.academic_year} – K${parseFloat(p.amount || 0).toFixed(2)} – Batch: ${p.batch_number || 'N/A'} – ${(p.payment_date || '').toString().slice(0, 10)}`
      );
    }
    doc.moveDown();

    const certDate = new Date().toISOString().split('T')[0];
    doc.fontSize(10).text(
      `This certifies that ${student_name || 'the above student'} has completed all required payments at ICU as at ${certDate}.`,
      { align: 'justify' }
    );
    doc.moveDown(2);

    doc.fontSize(10).text('Authorized Signatures:', { continued: false });
    doc.moveDown(1);

    const col1 = 50;
    const col2 = 220;
    const col3 = 390;
    const baseY = doc.y;
    const lineY = baseY;

    doc.fontSize(9);
    doc.moveTo(col1, lineY).lineTo(col1 + 130, lineY).stroke();
    doc.text(accountant_signer || '_________________', col1, baseY + 6, { width: 130 });
    doc.text('Title: Accounts Staff', col1, baseY + 20);
    doc.text(`Date: ${certDate}`, col1, baseY + 34);

    doc.moveTo(col2, lineY).lineTo(col2 + 130, lineY).stroke();
    doc.text(admin_signer || '_________________', col2, baseY + 6, { width: 130 });
    doc.text('Title: Admin Officer', col2, baseY + 20);
    doc.text(`Date: ${certDate}`, col2, baseY + 34);

    doc.moveTo(col3, lineY).lineTo(col3 + 130, lineY).stroke();
    doc.text(registrar_signer || '_________________', col3, baseY + 6, { width: 130 });
    doc.text('Title: Registrar', col3, baseY + 20);
    doc.text(`Date: ${certDate}`, col3, baseY + 34);

    doc.end();

    stream.on('finish', () => resolve(`/uploads/statements/${filename}`));
    stream.on('error', reject);
    doc.on('error', reject);
  });
}

module.exports = {
  generateReceiptPdf,
  saveReceiptPdf,
  generateStatementPDF,
  generateStatement,
  generateProofOfNoBalancePDF,
  generatePaymentCompletionCertificatePDF,
};
