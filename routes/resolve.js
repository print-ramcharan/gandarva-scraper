const express = require('express');
const { isValidVideoId } = require('../utils/validate');
const { resolve } = require('../services/ytResolver');
const cache = require('../services/cache');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /resolve
 *
 * Accepts { "videoId": "<11-char ID>" } and returns the direct audio
 * stream URL from YouTube's CDN.  Results are LRU-cached for 10 min.
 */
router.post('/resolve', async (req, res) => {
  const { videoId } = req.body || {};

  // --- Validation --------------------------------------------------------
  if (!videoId) {
    return res.status(400).json({ success: false, error: 'videoId is required' });
  }

  if (!isValidVideoId(videoId)) {
    return res.status(400).json({ success: false, error: 'Invalid video ID format' });
  }

  // --- Cache check -------------------------------------------------------
  const cached = cache.get(videoId);
  if (cached) {
    logger.info('Cache HIT', { videoId });
    return res.json({ success: true, audioUrl: cached, expiresIn: '~10 minutes' });
  }

  logger.info('Cache MISS', { videoId });

  // --- Resolve -----------------------------------------------------------
  try {
    const audioUrl = await resolve(videoId);
    cache.set(videoId, audioUrl);
    return res.json({ success: true, audioUrl, expiresIn: '~10 minutes' });
  } catch (err) {
    const status = err.status || 500;
    const message = err.status ? err.message : 'Internal server error';
    return res.status(status).json({ success: false, error: message });
  }
});

module.exports = router;
