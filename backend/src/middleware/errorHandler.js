const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('unhandled_error', {
    id: req.id,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });

  if (err.message === 'Not allowed by CORS' || err.message === 'Origin not permitted by CORS policy') {
    return res.status(403).json({ error: 'Origin not allowed', requestId: req.id });
  }

  const isMulter =
    err?.name === 'MulterError' ||
    err?.code === 'LIMIT_FILE_SIZE' ||
    /Invalid file type/i.test(err?.message || '');

  if (isMulter) {
    return res.status(400).json({
      error: 'Upload failed',
      message: err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : 'Invalid upload',
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const isProd = process.env.NODE_ENV === 'production';
  const clientMessage =
    statusCode < 500 ? err.message || 'Request failed' : 'Internal Server Error';

  res.status(statusCode).json({
    error: isProd && statusCode >= 500 ? 'An unexpected error occurred.' : clientMessage,
    requestId: req.id,
    ...(!isProd && statusCode >= 500 && { stack: err.stack }),
  });
}

module.exports = errorHandler;
