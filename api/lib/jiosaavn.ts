import axios from 'axios';
import CryptoJS from 'crypto-js';

const baseUrl = 'https://www.jiosaavn.com/api.php';
const axiosInstance = axios.create({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
  }
});

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
  const key = CryptoJS.enc.Utf8.parse('38346591'); // Standard decryption key for JioSaavn
  const decrypted = CryptoJS.DES.decrypt(
    encUrl,
    key,
    {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7,
    }
  );

  const decryptedUrl = decrypted.toString(CryptoJS.enc.Utf8);
  return decryptedUrl.replace('_i.mp4', '_320.mp4').replace('_64.mp4', '_320.mp4');
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

  const response = await axiosInstance.get(baseUrl, { params });
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

  const response = await axiosInstance.get(baseUrl, { params });
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
    const response = await axiosInstance.get(baseUrl, { params });
    return (response.data as any).lyrics || null;
  } catch (e) {
    return null;
  }
}
