const express = require('express');
const cache = require('../services/cache');

const router = express.Router();

/**
 * GET /health
 *
 * Render health-check endpoint.  Returns uptime, yt-dlp version, and
 * current cache occupancy.
 */
router.get('/health', async (_req, res) => {
  res.json({
    status: 'ok',
    liveness: true,
    uptime: Math.floor(process.uptime()),
    cacheSize: cache.size(),
  });
});

router.get('/ready', async (_req, res) => {
  const readiness = await require('../services/ytResolver').checkReadiness();
  res.status(readiness.ready ? 200 : 503).json({
    status: readiness.ready ? 'ready' : 'not_ready',
    readiness,
    cacheSize: cache.size(),
  });
});

module.exports = router;
