import { AudioSource, Track } from '../types';

export const HF_CONFIG = {
  HF_USER: "CoolJaat",
  HF_REPO: "my-music-library",
};

export const SUPPORTED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg', '.flac'];

/**
 * Format string into title case, keeping numbers and short acronyms
 */
function formatWords(str: string): string {
  if (!str) return '';
  return str
    .split(' ')
    .filter(Boolean)
    .map(word => {
      if (/^[0-9]+$/.test(word) || (word.toUpperCase() === word && word.length <= 3)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * STRICT PARSING & POSTER DERIVATION RULES:
 * 1. Never display file extensions (.mp3, .jpg, .png, .wav, etc.) in UI.
 * 2. Replace dashes and underscores with clean spacing.
 * 3. Parse "Artist Name - Song Title.mp3":
 *    - Song Title: Display clean song title only.
 *    - Artist Name: Display clean artist name.
 * 4. Poster image URL format:
 *    https://huggingface.co/datasets/CoolJaat/my-music-library/resolve/main/${encodeURIComponent(basename)}.jpg
 */
export function parseTrackMetadata(path: string): {
  title: string;
  artist: string;
  basename: string;
  posterUrl: string;
  audioUrl: string;
} {
  // Extract filename from path
  const filename = path.split('/').pop() || path;

  // Remove any audio/image file extensions strictly
  const basename = filename.replace(/\.(mp3|wav|m4a|ogg|flac|jpg|jpeg|png)$/gi, '');

  // Direct Hugging Face asset endpoints
  const posterUrl = `https://huggingface.co/datasets/${HF_CONFIG.HF_USER}/${HF_CONFIG.HF_REPO}/resolve/main/${encodeURIComponent(basename)}.jpg`;
  const audioUrl = `https://huggingface.co/datasets/${HF_CONFIG.HF_USER}/${HF_CONFIG.HF_REPO}/resolve/main/${encodeURIComponent(path)}`;

  // Clean string by replacing underscores with spaces
  let cleanStr = basename.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

  // Parse "Song Title - Artist Name" or "Artist - Title" format
  if (cleanStr.includes(' - ')) {
    const parts = cleanStr.split(' - ');
    const rawTitle = parts[0].trim();
    const rawArtist = parts.slice(1).join(' - ').trim();

    const title = formatWords(rawTitle);
    const artist = formatWords(rawArtist);

    return {
      title: title || 'Untitled Track',
      artist: artist || 'CoolJaat',
      basename,
      posterUrl,
      audioUrl,
    };
  } else if (cleanStr.includes('-')) {
    const parts = cleanStr.split('-');
    const rawTitle = parts[0].trim();
    const rawArtist = parts.slice(1).join('-').trim();

    const title = formatWords(rawTitle);
    const artist = formatWords(rawArtist);

    return {
      title: title || 'Untitled Track',
      artist: artist || 'CoolJaat',
      basename,
      posterUrl,
      audioUrl,
    };
  }

  // Fallback if no dash separator
  const title = formatWords(cleanStr);
  return {
    title: title || 'Untitled Track',
    artist: 'CoolJaat',
    basename,
    posterUrl,
    audioUrl,
  };
}

/**
 * Backward compatible cleanFileName helper
 */
export function cleanFileName(path: string): string {
  return parseTrackMetadata(path).title;
}

/**
 * Generate deterministic vivid gradient color pairs from a string hash
 */
export function getGradientColors(str: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const palettes: [string, string][] = [
    ['#1DB954', '#191414'], // Spotify Green & Dark
    ['#8E2DE2', '#4A00E0'], // Vivid Violet
    ['#FF416C', '#8A2387'], // Neon Rose & Purple
    ['#00B4DB', '#0083B0'], // Deep Electric Cyan
    ['#F7971E', '#FFD200'], // Warm Amber
    ['#FC466B', '#3F5EFB'], // Electric Crimson & Blue
    ['#00F2FE', '#4FACFE'], // Bright Turquoise
    ['#11998E', '#38EF7D'], // Emerald Mint
  ];

  const index = Math.abs(hash) % palettes.length;
  return palettes[index];
}

/**
 * Generate a dynamic SVG cover art Data URL as fallback
 */
export function generateCoverArt(title: string, artist: string, colors: [string, string]): string {
  const initials = title
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${colors[0]}" />
          <stop offset="100%" stop-color="${colors[1]}" />
        </linearGradient>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000" flood-opacity="0.4"/>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)" />
      
      <!-- Abstract decorative circles -->
      <circle cx="240" cy="60" r="90" fill="white" fill-opacity="0.08" />
      <circle cx="60" cy="240" r="110" fill="black" fill-opacity="0.15" />
      
      <!-- Initials Badge -->
      <circle cx="150" cy="115" r="45" fill="black" fill-opacity="0.25" filter="url(#shadow)" />
      <text x="150" y="127" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="36" fill="#FFFFFF" text-anchor="middle" letter-spacing="2">
        ${initials || '🎵'}
      </text>
      
      <!-- Title text -->
      <text x="150" y="185" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="16" fill="#FFFFFF" text-anchor="middle">
        ${title.length > 22 ? title.substring(0, 20) + '...' : title}
      </text>
      <text x="150" y="210" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="500" font-size="13" fill="#FFFFFF" fill-opacity="0.75" text-anchor="middle">
        ${artist.length > 25 ? artist.substring(0, 23) + '...' : artist}
      </text>
    </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Format seconds into mm:ss
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Time-based dynamic greeting
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  } else if (hour >= 12 && hour < 18) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

/**
 * Fisher-Yates shuffle — returns a new, randomly-ordered copy of the array.
 * Used so the home page never shows tracks alphabetically and reshuffles
 * every time the app is opened.
 */
export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Build direct HF audio streaming URL
 */
export function getHFAudioUrl(user: string, repo: string, path: string): string {
  return `https://huggingface.co/datasets/${user}/${repo}/resolve/main/${encodeURIComponent(path)}`;
}

