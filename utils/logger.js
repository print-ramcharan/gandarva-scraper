/**
 * Structured logger.
 *
 * Prints timestamped, level-tagged lines to stdout so Render's log viewer
 * can index them without any external logging library.
 */

function log(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const pairs = Object.entries(meta)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  const suffix = pairs ? ` ${pairs}` : '';
  console.log(`[${timestamp}] [${level}] ${message}${suffix}`);
}

module.exports = {
  info:  (msg, meta) => log('INFO',  msg, meta),
  warn:  (msg, meta) => log('WARN',  msg, meta),
  error: (msg, meta) => log('ERROR', msg, meta),
};
