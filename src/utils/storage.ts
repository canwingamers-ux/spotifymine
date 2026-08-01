import { Playlist, Track } from '../types';

const KEYS = {
  LIKED_TRACKS: 'spotify_liked_tracks_v1',
  VOLUME: 'spotify_volume_v1',
  MUTED: 'spotify_muted_v1',
  LAST_PLAYED: 'spotify_last_played_v1',
  PLAYLISTS: 'spotify_playlists_v1',
  UPLOADED_TRACKS: 'spotify_uploaded_tracks_v1',
};

export const Storage = {
  getLikedTrackIds(): string[] {
    try {
      const data = localStorage.getItem(KEYS.LIKED_TRACKS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  setLikedTrackIds(ids: string[]): void {
    try {
      localStorage.setItem(KEYS.LIKED_TRACKS, JSON.stringify(ids));
    } catch (e) {
      console.error('Failed to save liked tracks to localStorage', e);
    }
  },

  toggleLikedTrack(id: string): string[] {
    const ids = this.getLikedTrackIds();
    const index = ids.indexOf(id);
    let updated: string[];
    if (index >= 0) {
      updated = ids.filter(i => i !== id);
    } else {
      updated = [...ids, id];
    }
    this.setLikedTrackIds(updated);
    return updated;
  },

  getVolume(): number {
    try {
      const vol = localStorage.getItem(KEYS.VOLUME);
      return vol !== null ? parseFloat(vol) : 0.8;
    } catch {
      return 0.8;
    }
  },

  setVolume(volume: number): void {
    try {
      localStorage.setItem(KEYS.VOLUME, volume.toString());
    } catch (e) {
      console.error('Failed to save volume', e);
    }
  },

  getMuted(): boolean {
    try {
      return localStorage.getItem(KEYS.MUTED) === 'true';
    } catch {
      return false;
    }
  },

  setMuted(muted: boolean): void {
    try {
      localStorage.setItem(KEYS.MUTED, String(muted));
    } catch (e) {
      console.error('Failed to save muted state', e);
    }
  },

  getLastPlayed(): { trackId: string; currentTime: number } | null {
    try {
      const data = localStorage.getItem(KEYS.LAST_PLAYED);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setLastPlayed(trackId: string, currentTime: number): void {
    try {
      localStorage.setItem(KEYS.LAST_PLAYED, JSON.stringify({ trackId, currentTime }));
    } catch (e) {
      console.error('Failed to save last played', e);
    }
  },

  getCustomPlaylists(): Playlist[] {
    try {
      const data = localStorage.getItem(KEYS.PLAYLISTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  setCustomPlaylists(playlists: Playlist[]): void {
    try {
      localStorage.setItem(KEYS.PLAYLISTS, JSON.stringify(playlists));
    } catch (e) {
      console.error('Failed to save playlists', e);
    }
  },

  getUploadedTracks(): Track[] {
    try {
      const data = localStorage.getItem(KEYS.UPLOADED_TRACKS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveUploadedTracks(tracks: Track[]): void {
    try {
      localStorage.setItem(KEYS.UPLOADED_TRACKS, JSON.stringify(tracks));
    } catch (e) {
      console.error('Failed to save uploaded tracks', e);
    }
  }
};
