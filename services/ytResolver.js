const { execWithTimeout } = require('../utils/timeout');
const logger = require('../utils/logger');
// const { execSync } = require('child_process');

const YT_DLP_PATH = process.env.YT_DLP_PATH || 'yt-dlp';
const TIMEOUT_MS = 10000;

console.log('PATH:', process.env.PATH);

// try {
//   console.log(
//     'which yt-dlp:',
//     execSync('which yt-dlp').toString().trim()
//   );
// } catch (e) {
//   console.error('Cannot locate yt-dlp:', e);
// }
async function resolve(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const args = ['-f', 'ba', '-g', '--no-playlist', url];

  logger.info('Executing yt-dlp', { videoId });
  const start = Date.now();

  try {
    const audioUrl = await execWithTimeout(YT_DLP_PATH, args, TIMEOUT_MS);
    const durationMs = Date.now() - start;
    logger.info('yt-dlp resolved', { videoId, durationMs });
    return audioUrl;
  } catch (err) {
    const durationMs = Date.now() - start;

    if (err.message === 'TIMEOUT') {
      logger.error('yt-dlp timeout', { videoId, durationMs });
      const e = new Error('yt-dlp timed out');
      e.status = 504;
      throw e;
    }

    logger.error('yt-dlp failed', { videoId, durationMs, error: err.message });
    const e = new Error('Failed to resolve audio URL');
    e.status = 500;
    throw e;
  }
}

/**
 * Get the installed yt-dlp version string.
 * Returns "unavailable" if the binary is missing or broken.
 */
async function getVersion() {
  try {
    return await execWithTimeout(YT_DLP_PATH, ['--version'], 5000);
  } catch {
    return 'unavailable';
  }
}

module.exports = { resolve, getVersion };
