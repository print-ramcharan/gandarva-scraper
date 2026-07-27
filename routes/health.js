const express = require('express');
const cache = require('../services/cache');
const { getVersion } = require('../services/ytResolver');

const router = express.Router();

/**
 * GET /health
 *
 * Render health-check endpoint.  Returns uptime, yt-dlp version, and
 * current cache occupancy.
 */
router.get('/health', async (_req, res) => {
  const version = await getVersion();
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    ytDlp: version,
    cacheSize: cache.size(),
  });
});

module.exports = router;
