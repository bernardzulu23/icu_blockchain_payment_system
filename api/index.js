/**
 * @deprecated This serverless handler is NOT used in production.
 *
 * Fabric gRPC requires a persistent Express process on the Fabric VPS.
 * Vercel deploys frontend-only — see docs/DEPLOYMENT.md and vercel.json.
 */
module.exports = async (req, res) => {
  res.status(503).json({
    error: 'API not hosted on Vercel',
    message:
      'Deploy the Express backend on the Fabric VPS. Configure VITE_API_URL to point the React frontend at that API host.',
    docs: 'docs/DEPLOYMENT.md',
  });
};
