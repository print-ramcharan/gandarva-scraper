/**
 * Gandharva API service layer.
 *
 * Every screen and component must go through these helpers instead of
 * calling `fetch()` directly. This keeps the frontend provider-agnostic —
 * swapping music sources only requires backend changes.
 */

import { API_BASE } from '../config/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: string;
  source: string;
}

export interface DownloadLink {
  quality: string;
  link: string;
}

export interface SongDetail {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: string;
  downloadUrl: DownloadLink[];
}

export interface LyricsData {
  lyrics: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 1;

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Fetch wrapper with timeout, retry, and safe error handling.
 */
async function request<T>(path: string, retries = MAX_RETRIES): Promise<T> {
  const url = `${API_BASE}${path}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(
          (body as any)?.error ?? `Request failed (${res.status})`,
          res.status,
        );
      }

      const json = (await res.json()) as { data: T };
      return json.data;
    } catch (err) {
      const isLast = attempt === retries;

      // Don't retry client errors (4xx)
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        throw err;
      }

      if (isLast) {
        if (err instanceof ApiError) throw err;
        throw new ApiError('Unable to load songs. Please try again.', 0);
      }

      // Brief pause before retry
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Unreachable, but satisfies TS
  throw new ApiError('Unable to load songs. Please try again.', 0);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search for songs by text query.
 */
export async function searchSongs(query: string): Promise<SearchResult[]> {
  return request<SearchResult[]>(
    `/search?query=${encodeURIComponent(query)}`,
  );
}

/**
 * Get full song details (including download URLs) by song ID.
 */
export async function getSong(id: string): Promise<SongDetail> {
  return request<SongDetail>(`/songs?id=${encodeURIComponent(id)}`);
}

/**
 * Get lyrics for a song by its ID.
 */
export async function getLyrics(id: string): Promise<LyricsData> {
  return request<LyricsData>(`/lyrics?id=${encodeURIComponent(id)}`);
}
