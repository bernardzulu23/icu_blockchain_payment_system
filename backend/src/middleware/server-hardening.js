/**
 * ICU Pay — Application-Layer Security Hardening
 * Apply via applyServerHardening(app) in createApp.js BEFORE routes.
 *
 * npm i helmet express-rate-limit express-slow-down hpp cors cookie-parser winston
 */
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const hpp = require('hpp');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const env = require('../config/environment');
const logger = require('../utils/logger');

const isDev = env.NODE_ENV !== 'production';

/** Shared rate-limit options — avoids ERL crashes behind Vercel/proxy */
const rateLimitShared = {
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
};

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 2000 : 300,
  message: { error: 'Too many requests. Please try again shortly.' },
  ...rateLimitShared,
});

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: isDev ? 500 : 100,
  delayMs: (hits) => Math.min(hits * 100, 3000),
  validate: { delayMs: false },
});

function buildCspDirectives() {
  const connectSrc = ["'self'"];
  if (env.API_ORIGIN) connectSrc.push(env.API_ORIGIN);
  for (const origin of env.FRONTEND_ORIGINS || []) {
    if (origin) connectSrc.push(origin);
  }

  return {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", 'data:'],
    connectSrc,
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    ...(isDev ? {} : { upgradeInsecureRequests: [] }),
  };
}

function permissionsPolicy(req, res, next) {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
  );
  next();
}

function requestIdMiddleware(req, res, next) {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  const start = Date.now();
  res.on('finish', () => {
    logger.info('request', {
      id: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
      userId: req.user?.id ?? req.user?.userId ?? null,
      ip: req.ip,
    });
  });
  next();
}

/**
 * @param {import('express').Express} app
 * @param {{ isAllowedOrigin?: (origin: string | undefined) => boolean }} [options]
 */
function applyServerHardening(app, options = {}) {
  const isAllowedOrigin =
    options.isAllowedOrigin ||
    ((origin) => {
      if (!origin) return true;
      const allowed = new Set([
        ...(env.FRONTEND_ORIGINS || []),
        ...(env.ALLOWED_ORIGINS || []),
      ]);
      return allowed.has(origin);
    });

  if (env.TRUST_PROXY) {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: isDev ? false : { directives: buildCspDirectives() },
      hsts: isDev
        ? false
        : {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: false,
          },
      noSniff: true,
      frameguard: { action: 'deny' },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  app.use(permissionsPolicy);

  app.use(
    cors({
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) {
          return callback(null, true);
        }
        logger.warn(`CORS blocked origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
      maxAge: 600,
    })
  );

  app.use(globalLimiter);
  app.use(speedLimiter);
  app.use(hpp());

  app.use(express.json({ limit: env.BODY_JSON_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: env.BODY_JSON_LIMIT }));

  if (env.COOKIE_SECRET) {
    app.use(cookieParser(env.COOKIE_SECRET));
  } else {
    app.use(cookieParser());
  }

  app.use(requestIdMiddleware);
}

module.exports = {
  applyServerHardening,
  globalLimiter,
  speedLimiter,
  requestIdMiddleware,
};
