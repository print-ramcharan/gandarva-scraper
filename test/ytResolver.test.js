const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {
  resolve,
  checkReadiness,
  parseSingleHttpUrl,
  __setCommandRunnerForTests,
} = require('../services/ytResolver');

const validUrl = 'https://cdn.example.test/audio.m4a?sig=redacted';

test.afterEach(() => {
  __setCommandRunnerForTests(async () => ({ stdout: validUrl, stderr: '', exitCode: 0 }));
});

test('uses Deno, BgUtils PO tokens, fallback player clients, and audio-only extraction', async () => {
  let commandArgs;
  let commandOptions;
  __setCommandRunnerForTests(async (_file, args, options) => {
    commandArgs = args;
    commandOptions = options;
    return { stdout: `${validUrl}\n`, stderr: '', exitCode: 0 };
  });
  assert.equal(await resolve('abcdefghijk'), validUrl);
  assert.ok(commandArgs.includes('--verbose'));
  assert.ok(commandArgs.includes('bestaudio'));
  assert.ok(commandArgs.includes('--js-runtimes'));
  assert.ok(commandArgs.some(argument => String(argument).startsWith('deno:')));
  const extractorArgsIndex = commandArgs.indexOf('--extractor-args');
  assert.notEqual(extractorArgsIndex, -1);
  assert.match(commandArgs[extractorArgsIndex + 1], /youtubepot-bgutilhttp:base_url=/);
  assert.match(commandArgs[extractorArgsIndex + 1], /youtube:player_client=mweb,tv,web_safari/);
  assert.equal(commandOptions.timeoutMs, 30_000);
  assert.ok(!commandArgs.includes('bestvideo'));
});

test('rejects empty, multiple, and malformed output', () => {
  assert.throws(() => parseSingleHttpUrl(''), /invalid output/i);
  assert.throws(() => parseSingleHttpUrl(`${validUrl}\nhttps://second.test/a`), /invalid output/i);
  assert.throws(() => parseSingleHttpUrl('not-a-url'), /invalid output/i);
});

test('maps timeout to a safe 504 error', async () => {
  __setCommandRunnerForTests(async () => { throw { code: 'TIMEOUT', timedOut: true, stderr: '' }; });
  await assert.rejects(resolve('timeout1234'), error => error.kind === 'timeout' && error.status === 504);
});

test('maps missing executable to a safe 503 error', async () => {
  __setCommandRunnerForTests(async () => { throw { code: 'MISSING_EXECUTABLE', missingExecutable: true, stderr: '' }; });
  await assert.rejects(resolve('missing1234'), error => error.kind === 'missing_executable' && error.status === 503);
});

test('maps unavailable and YouTube-blocked stderr without exposing it', async () => {
  __setCommandRunnerForTests(async () => { throw { stderr: 'ERROR: Video unavailable', exitCode: 1 }; });
  await assert.rejects(resolve('unavail1234'), error => error.kind === 'video_unavailable' && error.message === 'Video is unavailable');

  __setCommandRunnerForTests(async () => { throw { stderr: 'Sign in to confirm you are not a bot', exitCode: 1 }; });
  await assert.rejects(resolve('blocked12345'), error => error.kind === 'youtube_blocked' && !error.message.includes('bot'));
});

test('maps YouTube HTTP 429 to a safe rate-limit response', async () => {
  __setCommandRunnerForTests(async () => { throw { stderr: 'ERROR: HTTP Error 429: Too Many Requests', exitCode: 1 }; });
  await assert.rejects(resolve('ratelimit123'), error => (
    error.kind === 'youtube_rate_limited'
    && error.status === 429
    && !error.message.includes('429')
  ));
});

test('deduplicates concurrent requests for the same video', async () => {
  let calls = 0;
  __setCommandRunnerForTests(async () => {
    calls += 1;
    await new Promise(resolvePromise => setTimeout(resolvePromise, 20));
    return { stdout: validUrl, stderr: '', exitCode: 0 };
  });
  const results = await Promise.all([resolve('samevideo01'), resolve('samevideo01'), resolve('samevideo01')]);
  assert.deepEqual(results, [validUrl, validUrl, validUrl]);
  assert.equal(calls, 1);
});

test('limits concurrent yt-dlp processes', async () => {
  let active = 0;
  let peak = 0;
  __setCommandRunnerForTests(async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise(resolvePromise => setTimeout(resolvePromise, 15));
    active -= 1;
    return { stdout: validUrl, stderr: '', exitCode: 0 };
  });
  await Promise.all(['onevideo01', 'twovideo02', 'threevideo', 'fourvideo1'].map(resolve));
  assert.ok(peak <= 2, `peak concurrency was ${peak}`);
});

test('readiness reports unavailable yt-dlp separately from liveness', async () => {
  __setCommandRunnerForTests(async file => {
    throw { code: 'MISSING_EXECUTABLE', missingExecutable: true, file };
  });
  const readiness = await checkReadiness();
  assert.equal(readiness.ready, false);
  assert.equal(readiness.version, 'unavailable');
  assert.equal(readiness.javascriptRuntime.available, false);
});

test('readiness includes yt-dlp and JavaScript runtime versions', async () => {
  __setCommandRunnerForTests(async file => ({
    stdout: file === 'deno' ? 'deno 2.9.8\n' : '2026.10.26\n',
    stderr: '',
    exitCode: 0,
  }));
  const readiness = await checkReadiness();
  assert.equal(readiness.ready, true);
  assert.equal(readiness.version, '2026.10.26');
  assert.equal(readiness.javascriptRuntime.version, 'deno 2.9.8');
  assert.equal(readiness.potProvider.configured, false);
});

test('GET /ready returns 503 when yt-dlp is unavailable', async () => {
  __setCommandRunnerForTests(async () => { throw { code: 'MISSING_EXECUTABLE', missingExecutable: true }; });
  const app = require('../server');
  const server = http.createServer(app);
  await new Promise(resolvePromise => server.listen(0, '127.0.0.1', resolvePromise));
  const { port } = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/ready`);
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.status, 'not_ready');
  } finally {
    await new Promise(resolvePromise => server.close(resolvePromise));
  }
});
