export type AudioSource = 'hf' | 'curated';

export interface Track {
  id: string;
  path: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  audioUrl: string;
  coverArtUrl?: string;
  gradientColors: [string, string];
  size?: number;
  source: AudioSource;
  dateAdded?: string;
  lrc?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverArt?: string;
  gradient: string;
  trackIds: string[];
  isCustom?: boolean;
}

export type RepeatMode = 'off' | 'all' | 'one';

export type ActiveTab = 'home' | 'search' | 'library' | 'liked' | 'playlist' | 'lyrics' | 'admin';

export interface ToastMessage {
  id: string;
  type: 'info' | 'error' | 'success';
  message: string;
}
