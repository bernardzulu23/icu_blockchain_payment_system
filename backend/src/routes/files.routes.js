const express = require('express');
const path = require('path');
const fs = require('fs');
const { verifyAccessToken, loadUserFromToken } = require('../middleware/auth');
const {
  resolveLocalUploadPath,
  isRemoteUrl,
  isSupabaseRef,
  readStoredFile,
} = require('../services/storageService');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

const MIME_BY_EXT = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.csv': 'text/csv',
};

function contentTypeFor(filePath) {
  return MIME_BY_EXT[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

async function authenticateFileRequest(req, res, next) {
  try {
    const header = req.headers.authorization;
    const token = (header && header.split(' ')[1]) || req.query.token;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const decoded = verifyAccessToken(token);
    const user = await loadUserFromToken(decoded);
    if (!user || user.status !== 'active') {
      return res.status(403).json({ error: 'Access denied' });
    }
    req.user = {
      userId: decoded.userId,
      type: decoded.type || user.type,
      role: user.role,
      student_id: user.student_id,
      ...user,
    };
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

router.use(authenticateFileRequest);

router.get('*', async (req, res) => {
  try {
    // Supabase refs: /api/files/_sb/<urlencoded sb:bucket/path>
    // or ?ref=sb%3Aicu-uploads%2F...
    let storedRef = null;
    if (req.query.ref) {
      storedRef = String(req.query.ref);
    } else if (String(req.path || '').startsWith('/_sb/')) {
      storedRef = `sb:${decodeURIComponent(String(req.path).slice('/_sb/'.length))}`;
    }

    const role = req.user.type === 'student' ? 'student' : req.user.role;
    let urlPath = storedRef;

    if (!urlPath) {
      const relative = String(req.path || '').replace(/^\//, '');
      if (!relative || relative.includes('..')) {
        return res.status(400).json({ error: 'Invalid path' });
      }
      urlPath = `/uploads/${relative}`;
    }

    if (role === 'student') {
      const sid = req.user.student_id || req.user.userId;
      const allowed = await studentMayAccess(sid, urlPath);
      if (!allowed) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else if (!['admin', 'accountant', 'registrar'].includes(role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (isSupabaseRef(urlPath) || isRemoteUrl(urlPath)) {
      const buf = await readStoredFile(urlPath);
      res.setHeader('Content-Type', contentTypeFor(urlPath));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-store');
      return res.send(buf);
    }

    let fullPath;
    try {
      fullPath = resolveLocalUploadPath(urlPath);
    } catch {
      return res.status(400).json({ error: 'Invalid path' });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Type', contentTypeFor(fullPath));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(fullPath)}"`);
    return res.sendFile(fullPath);
  } catch (err) {
    logger.error('File download error:', err);
    return res.status(500).json({ error: 'Failed to download file' });
  }
});

async function studentMayAccess(studentId, urlPath) {
  const { rows } = await query(
    `SELECT 1 FROM student_payments
     WHERE student_id = $1
       AND (deposit_slip_url = $2 OR statement_pdf_url = $2)
     LIMIT 1`,
    [studentId, urlPath]
  );
  if (rows.length) return true;

  const cert = await query(
    `SELECT 1 FROM clearance_requests
     WHERE student_id = $1 AND clearance_certificate_url = $2
     LIMIT 1`,
    [studentId, urlPath]
  );
  if (cert.rows.length) return true;

  const profile = await query(
    `SELECT 1 FROM students
     WHERE student_id = $1 AND profile_picture_url = $2
     LIMIT 1`,
    [studentId, urlPath]
  );
  return profile.rows.length > 0;
}

module.exports = router;
