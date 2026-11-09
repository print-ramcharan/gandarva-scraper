const { execWithTimeout } = require('../utils/timeout');
const logger = require('../utils/logger');

const YT_DLP_PATH = process.env.YT_DLP_PATH || 'yt-dlp';
const JS_RUNTIME_PATH = process.env.YT_DLP_JS_RUNTIME_PATH || 'deno';
const POT_PROVIDER_URL = process.env.BGUTIL_POT_PROVIDER_URL || '';
const POT_PROVIDER_BASE_URL = POT_PROVIDER_URL || 'http://127.0.0.1:4416';
const YOUTUBE_PLAYER_CLIENTS = process.env.YT_DLP_YOUTUBE_PLAYER_CLIENTS || 'mweb,tv,web_safari';
const TIMEOUT_MS = clampInt(process.env.YT_DLP_TIMEOUT_MS, 30_000, 1_000, 120_000);
const MAX_OUTPUT_BYTES = clampInt(process.env.YT_DLP_MAX_OUTPUT_BYTES, 1_048_576, 16_384, 8_388_608);
const MAX_CONCURRENT = clampInt(process.env.YT_DLP_MAX_CONCURRENT, 2, 1, 8);
const inFlight = new Map();
let activeProcesses = 0;
const waiters = [];
let commandRunner = execWithTimeout;

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function safeStderr(stderr = '') {
  return String(stderr)
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/([?&](?:key|token|sig|signature|oauth)[^\s]*)/gi, '[redacted]')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)[0]
    ?.slice(0, 240) || '';
}

function safePotDiagnostics(stderr = '') {
  const relevant = String(stderr)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => (
      /\[pot\] PO Token Providers/i.test(line)
      || /\[pot:bgutil(?::[^\]]+)?\].*(Generating|Retrieved|Error|provider)/i.test(line)
      || /Sign in to confirm|confirm you.re not a bot|LOGIN_REQUIRED|HTTP Error 429/i.test(line)
    ))
    .map(line => line
      .replace(/https?:\/\/\S+/gi, '[url]')
      .replace(/\b(?:PO Token|token|cookie|authorization)\b(?:\s*[:=]\s*)[^\s,;]+/gi, '[credential redacted]')
      .slice(0, 240))
    .slice(0, 8);
  return relevant.join(' | ');
}

function createResolverError(kind, status, message, details = {}) {
  const error = new Error(message);
  error.kind = kind;
  error.status = status;
  Object.assign(error, details);
  return error;
}

function classifyFailure(error) {
  const stderr = String(error?.stderr || '').toLowerCase();
  if (error?.missingExecutable || error?.code === 'MISSING_EXECUTABLE') {
    return createResolverError('missing_executable', 503, 'Audio resolver dependency unavailable');
  }
  if (error?.timedOut || error?.code === 'TIMEOUT') {
    return createResolverError('timeout', 504, 'Audio resolution timed out');
  }
  if (/video unavailable|private video|has been removed|this video is unavailable|not available in your country/.test(stderr)) {
    return createResolverError('video_unavailable', 404, 'Video is unavailable');
  }
  if (/http error 429|status code: 429|too many requests|rate limit|rate-limit/.test(stderr)) {
    return createResolverError('youtube_rate_limited', 429, 'YouTube rate limited the resolver request');
  }
  if (/sign in to confirm|bot|captcha|confirm you.re not a bot/.test(stderr)) {
    return createResolverError('youtube_blocked', 502, 'YouTube blocked the resolver request');
  }
  if (/timed out|timeout|network|connection|temporary failure|unable to download/.test(stderr)) {
    return createResolverError('network_failure', 502, 'Resolver network request failed');
  }
  return createResolverError('unexpected', 500, 'Audio resolution failed');
}

function parseSingleHttpUrl(stdout) {
  const lines = String(stdout || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length !== 1) {
    throw createResolverError('invalid_output', 502, 'Resolver returned invalid output');
  }
  let parsed;
  try {
    parsed = new URL(lines[0]);
  } catch {
    throw createResolverError('invalid_output', 502, 'Resolver returned invalid output');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw createResolverError('invalid_output', 502, 'Resolver returned invalid output');
  }
  return parsed.toString();
}

async function acquireSlot() {
  if (activeProcesses < MAX_CONCURRENT) {
    activeProcesses += 1;
    return;
  }
  await new Promise(resolve => waiters.push(resolve));
  activeProcesses += 1;
}

function releaseSlot() {
  activeProcesses -= 1;
  const next = waiters.shift();
  if (next) next();
}

async function resolveOnce(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  // Try multiple documented player clients so a client that requires an
  // unavailable auth flow does not prevent other clients from requesting PO Tokens.
  const extractorArgs = `youtubepot-bgutilhttp:base_url=${POT_PROVIDER_BASE_URL};youtube:player_client=${YOUTUBE_PLAYER_CLIENTS}`;
  const args = [
    '--no-warnings',
    '--verbose',
    '--js-runtimes', `deno:${JS_RUNTIME_PATH}`,
    '--extractor-args', extractorArgs,
    '--no-playlist',
    '--skip-download',
    '-f', 'bestaudio',
    '-g', url,
  ];
  const startedAt = Date.now();
  await acquireSlot();
  try {
    logger.info('Executing yt-dlp', { videoId, concurrency: activeProcesses });
    let result;
    try {
      result = await commandRunner(YT_DLP_PATH, args, { timeoutMs: TIMEOUT_MS, maxOutputBytes: MAX_OUTPUT_BYTES });
    } catch (error) {
      const classified = classifyFailure(error);
      logger.error('yt-dlp failed', {
        videoId,
        kind: classified.kind,
        exitCode: error?.exitCode ?? null,
        durationMs: Date.now() - startedAt,
        stderr: safeStderr(error?.stderr),
        potDiagnostics: safePotDiagnostics(error?.stderr),
      });
      throw classified;
    }

    let audioUrl;
    try {
      audioUrl = parseSingleHttpUrl(result.stdout);
    } catch (error) {
      logger.error('yt-dlp returned invalid URL output', {
        videoId,
        durationMs: Date.now() - startedAt,
        exitCode: result.exitCode,
      });
      throw error;
    }
    logger.info('yt-dlp resolved', { videoId, durationMs: Date.now() - startedAt, exitCode: result.exitCode });
    return audioUrl;
  } finally {
    releaseSlot();
  }
}

function resolve(videoId) {
  const existing = inFlight.get(videoId);
  if (existing) return existing;
  const promise = resolveOnce(videoId).finally(() => inFlight.delete(videoId));
  inFlight.set(videoId, promise);
  return promise;
}

async function getVersion() {
  try {
    const result = await commandRunner(YT_DLP_PATH, ['--version'], { timeoutMs: 5_000, maxOutputBytes: 16_384 });
    const version = String(result.stdout || '').trim().split(/\r?\n/);
    return version.length === 1 && version[0] ? version[0].slice(0, 64) : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

async function getJavaScriptRuntime() {
  try {
    const result = await commandRunner(JS_RUNTIME_PATH, ['--version'], { timeoutMs: 5_000, maxOutputBytes: 16_384 });
    const version = String(result.stdout || '').trim().split(/\r?\n/)[0];
    return {
      executable: JS_RUNTIME_PATH,
      available: Boolean(version),
      version: version ? version.slice(0, 64) : 'unavailable',
    };
  } catch {
    return { executable: JS_RUNTIME_PATH, available: false, version: 'unavailable' };
  }
}

async function getPotProviderReadiness() {
  if (!POT_PROVIDER_URL) {
    return { configured: false, available: false, url: null };
  }
  try {
    const response = await fetch(new URL('/ping', POT_PROVIDER_URL), {
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) {
      return { configured: true, available: false, status: response.status };
    }
    const body = await response.json();
    return {
      configured: true,
      available: Boolean(body?.version),
      version: typeof body?.version === 'string' ? body.version.slice(0, 64) : 'unknown',
    };
  } catch {
    return { configured: true, available: false };
  }
}

async function checkReadiness() {
  const [version, javascriptRuntime, potProvider] = await Promise.all([
    getVersion(),
    getJavaScriptRuntime(),
    getPotProviderReadiness(),
  ]);
  const potProviderReady = !potProvider.configured || potProvider.available;
  return {
    ready: version !== 'unavailable' && javascriptRuntime.available && potProviderReady,
    executable: YT_DLP_PATH,
    version,
    javascriptRuntime,
    potProvider,
    timeoutMs: TIMEOUT_MS,
    maxConcurrent: MAX_CONCURRENT,
  };
}

function __setCommandRunnerForTests(runner) {
  commandRunner = runner;
  inFlight.clear();
  activeProcesses = 0;
  waiters.length = 0;
}

module.exports = {
  resolve,
  getVersion,
  checkReadiness,
  getJavaScriptRuntime,
  getPotProviderReadiness,
  parseSingleHttpUrl,
  classifyFailure,
  __setCommandRunnerForTests,
};
