import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { searchSongs, getSongDetails, getLyrics } from './lib/jiosaavn.js';

const app = new Hono();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// Request logging
app.use('*', async (c, next) => {
  const start = Date.now();
  console.log(`→ ${c.req.method} ${c.req.url}`);
  await next();
  const ms = Date.now() - start;
  console.log(`← ${c.req.method} ${c.req.url} ${c.res.status} ${ms}ms`);
});

// CORS
app.use('*', cors());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wrap a promise with a 10-second timeout so requests never hang. */
function withTimeout<T>(promise: Promise<T>, ms = 10_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out')), ms);
    promise
      .then((v) => { clearTimeout(timer); resolve(v); })
      .catch((e) => { clearTimeout(timer); reject(e); });
  });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** Health check */
app.get('/', (c) => {
  return c.json({ ok: true, service: 'Gandharva Backend' });
});

/** Favicon — prevent 404 noise */
app.get('/favicon.ico', (c) => c.body(null, 204));

/**
 * GET /search?query=<text>
 */
app.get('/search', async (c) => {
  const query = c.req.query('query');
  if (!query) {
    return c.json({ error: 'Query parameter "query" is required.' }, 400);
  }

  try {
    const results = await withTimeout(searchSongs(query));
    return c.json({ data: results });
  } catch {
    console.error(`[/search] Failed for query="${query}"`);
    return c.json({ error: 'Unable to load songs. Please try again.' }, 502);
  }
});

/**
 * GET /songs?id=<id>
 */
app.get('/songs', async (c) => {
  const id = c.req.query('id');
  if (!id) {
    return c.json({ error: 'Query parameter "id" is required.' }, 400);
  }

  try {
    const song = await withTimeout(getSongDetails(id));
    if (!song) {
      return c.json({ error: 'Song not found.' }, 404);
    }
    return c.json({ data: song });
  } catch {
    console.error(`[/songs] Failed for id="${id}"`);
    return c.json({ error: 'Unable to load song details. Please try again.' }, 502);
  }
});

/**
 * GET /lyrics?id=<id>
 */
app.get('/lyrics', async (c) => {
  const id = c.req.query('id');
  if (!id) {
    return c.json({ error: 'Query parameter "id" is required.' }, 400);
  }

  try {
    const lyrics = await withTimeout(getLyrics(id));
    return c.json({ data: { lyrics: lyrics ?? '' } });
  } catch {
    console.error(`[/lyrics] Failed for id="${id}"`);
    return c.json({ error: 'Unable to load lyrics. Please try again.' }, 502);
  }
});

// ---------------------------------------------------------------------------
// Global error handler — never expose stack traces
// ---------------------------------------------------------------------------
app.onError((err, c) => {
  console.error('[unhandled]', err);
  return c.json({ error: 'Internal server error.' }, 500);
});

export default app;
