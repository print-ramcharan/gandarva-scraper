import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { cors } from 'hono/cors';

// Note: Use .ts if using tsx or vercel-node, or omit extension
import { searchSongs, getSongDetails, getLyrics } from './lib/jiosaavn';

const app = new Hono();

// Enable CORS for all routes
app.use('*', async (c, next) => {
  console.log(`Incoming request: ${c.req.method} ${c.req.url}`);
  await next();
});
app.use('*', cors());

app.get('/', (c) => c.json({ message: 'Gandharva Scraper API is running! 🚀' }));

/**
 * GET /api/search?query=...
 */
app.get('/search', async (c) => {
  const query = c.req.query('query');
  if (!query) return c.json({ error: 'Query is required' }, 400);

  try {
    const results = await searchSongs(query);
    return c.json({ data: results });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/**
 * GET /api/songs?id=...
 */
app.get('/songs', async (c) => {
  const id = c.req.query('id');
  if (!id) return c.json({ error: 'ID is required' }, 400);

  try {
    const song = await getSongDetails(id);
    if (!song) return c.json({ error: 'Song not found' }, 404);
    return c.json({ data: song });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/**
 * GET /api/lyrics?id=...
 */
app.get('/lyrics', async (c) => {
  const id = c.req.query('id');
  if (!id) return c.json({ error: 'ID is required' }, 400);

  try {
    const lyrics = await getLyrics(id);
    return c.json({ data: { lyrics } });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// For Vercel deployment
export const runtime = 'nodejs';
export default handle(app);

// Local development server
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const port = 3000;
  console.log(`Gandharva Scraper is running on http://localhost:${port}`);
  
  // Dynamic import for local server to avoid issues in Vercel bundle
  import('@hono/node-server').then(({ serve }) => {
    serve({
      fetch: app.fetch,
      port
    });
  }).catch(err => {
    console.error('Failed to start local server:', err);
  });
}
