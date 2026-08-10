/**
 * Legacy stub — API is not deployed as a serverless function.
 * Run Express on a VPS and point the frontend at that host (see docs/DEPLOYMENT.md).
 */
module.exports = async (req, res) => {
  res.status(503).json({
    error: 'API not hosted here',
    message:
      'Deploy the Express backend on your VPS. Set VITE_API_URL to that API host when building the frontend.',
    docs: 'docs/DEPLOYMENT.md',
  });
};
