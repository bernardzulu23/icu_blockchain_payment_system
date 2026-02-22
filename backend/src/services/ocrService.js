const logger = require('../utils/logger');

async function extractTextFromImage(imageBuffer) {
  try {
    // Tesseract OCR - requires: npm install tesseract.js
    // const Tesseract = require('tesseract.js');
    // const { data } = await Tesseract.recognize(imageBuffer);
    // return data.text;
    logger.warn('OCR service not configured - install tesseract.js');
    return '';
  } catch (err) {
    logger.error('OCR extraction failed:', err);
    throw err;
  }
}

async function extractFromDepositSlip(filePath) {
  const fs = require('fs');
  const buffer = fs.readFileSync(filePath);
  return extractTextFromImage(buffer);
}

module.exports = { extractTextFromImage, extractFromDepositSlip };
