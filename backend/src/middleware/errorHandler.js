const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error(err);

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
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
    error: clientMessage,
    ...(!isProd && statusCode >= 500 && { stack: err.stack }),
  });
}

module.exports = errorHandler;
