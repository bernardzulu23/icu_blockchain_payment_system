const PDFDocument = require('pdfkit');
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

module.exports = { generateReceiptPdf, saveReceiptPdf, generateStatementPDF };
