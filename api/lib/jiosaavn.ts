import axios from 'axios';
import * as crypto from 'crypto';

const baseUrl = 'https://www.jiosaavn.com/api.php';

export interface SaavnSong {
  id: string;
  name: string;
  album: string;
  year: string;
  release_date: string;
  primary_artists: string;
  singers: string;
  image: string;
  duration: string;
  media_url?: string;
  download_url?: { quality: string; link: string }[];
}

/**
 * Decrypts the encrypted media URL from JioSaavn
 */
export function decryptUrl(encUrl: string): string {
  const key = '38346591'; // Standard decryption key for JioSaavn
  const decipher = crypto.createDecipheriv('des-ecb', Buffer.from(key, 'utf8'), null);
  let decrypted = (decipher as any).update(Buffer.from(encUrl, 'base64'), 'binary', 'utf8');
  decrypted += (decipher as any).final('utf8');
  return decrypted.replace('_i.mp4', '_320.mp4').replace('_64.mp4', '_320.mp4');
}

/**
 * Formats the image URL to 500x500
 */
function formatImage(url: string | undefined): string {
  if (!url) return '';
  return url.replace('150x150', '500x500').replace('50x50', '500x500');
}

/**
 * Searches for songs using autocomplete
 */
export async function searchSongs(query: string) {
  const params = {
    __call: 'autocomplete.get',
    _format: 'json',
    _marker: '0',
    cc: 'in',
    includeMetaTags: '1',
    query: query,
  };

  const response = await axios.get(baseUrl, { params });
  const data = response.data as any;
  const songs = data.songs?.data || [];

  return songs.map((s: any) => ({
    id: s.id,
    title: s.title,
    artist: s.description,
    artwork: formatImage(s.image),
    album: s.album,
    type: s.type
  }));
}

/**
 * Gets details for a specific song ID, including download links
 */
export async function getSongDetails(id: string) {
  const params = {
    __call: 'song.getDetails',
    pids: id,
    _format: 'json',
    _marker: '0',
    cc: 'in',
    includeMetaTags: '1',
  };

  const response = await axios.get(baseUrl, { params });
  const song = (response.data as any)[id];

  if (!song) return null;

  const encUrl = song.encrypted_media_url;
  const mediaUrl = encUrl ? decryptUrl(encUrl) : '';

  const downloadUrls = [
    { quality: '12kbps', link: mediaUrl.replace('_320.mp4', '_12.mp4') },
    { quality: '48kbps', link: mediaUrl.replace('_320.mp4', '_48.mp4') },
    { quality: '96kbps', link: mediaUrl.replace('_320.mp4', '_96.mp4') },
    { quality: '160kbps', link: mediaUrl.replace('_320.mp4', '_160.mp4') },
    { quality: '320kbps', link: mediaUrl }
  ];

  return {
    id: song.id,
    title: song.song,
    album: song.album,
    year: song.year,
    artist: song.primary_artists,
    artwork: formatImage(song.image),
    duration: song.duration,
    downloadUrl: downloadUrls,
    media_url: mediaUrl
  };
}

/**
 * Fetches lyrics for a song
 */
export async function getLyrics(id: string) {
  const params = {
    __call: 'lyrics.getLyrics',
    lyrics_id: id,
    ctx: 'web6dot0',
    api_version: '4',
    _format: 'json',
    _marker: '0',
  };

  try {
    const response = await axios.get(baseUrl, { params });
    return (response.data as any).lyrics || null;
  } catch (e) {
    return null;
  }
}
