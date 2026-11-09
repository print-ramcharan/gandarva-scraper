const express = require('express');
const { spawn } = require('node:child_process');
const logger = require('./utils/logger');
const healthRoute = require('./routes/health');
const resolveRoute = require('./routes/resolve');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(`${req.method} ${req.path}`, {
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use(healthRoute);
app.use(resolveRoute);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler — never expose stack traces
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

if (require.main === module) {
  const providerEntrypoint = process.env.BGUTIL_PROVIDER_ENTRYPOINT;
  let potProvider = null;

  if (providerEntrypoint) {
    const providerHost = process.env.BGUTIL_POT_PROVIDER_HOST || '127.0.0.1';
    const providerPort = process.env.BGUTIL_POT_PROVIDER_PORT || '4416';
    potProvider = spawn(
      process.execPath,
      [providerEntrypoint, '--host', providerHost, '--port', providerPort],
      { stdio: 'ignore', env: process.env },
    );

    potProvider.once('error', error => {
      logger.error('BgUtils PO token provider failed to start', { error: error.message });
    });
    potProvider.once('exit', (code, signal) => {
      if (code !== 0) {
        logger.error('BgUtils PO token provider exited', { code, signal });
      }
    });
  }

  const server = app.listen(PORT, () => {
    logger.info(`Gandharva Resolver listening on port ${PORT}`);
  });

  const shutdown = signal => {
    logger.info('Shutting down resolver', { signal });
    if (potProvider && !potProvider.killed) potProvider.kill(signal);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
