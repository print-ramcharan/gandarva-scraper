import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { searchSongs, getSongDetails, getLyrics } from './lib/jiosaavn.js';

const app = new Hono();

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
const handler = handle(app);

export const GET = handler;
export const POST = handler;

export default handler;
