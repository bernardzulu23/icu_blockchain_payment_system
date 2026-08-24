/**
 * Lightweight health check — separate from the Express API so it cannot time out
 * while the heavy /api function cold-starts.
 */
module.exports = (req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(
    JSON.stringify({
      status: 'OK',
      timestamp: new Date().toISOString(),
      vercel: Boolean(process.env.VERCEL),
      jwtConfigured: Boolean(
        process.env.JWT_SECRET &&
          process.env.JWT_SECRET.length >= 32 &&
          process.env.JWT_SECRET !== 'your-secret-key-change-in-production'
      ),
      databaseConfigured: Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL),
    })
  );
};
