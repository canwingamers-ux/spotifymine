import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ActiveTab,
  AiPlaylist,
  Playlist,
  RepeatMode,
  ToastMessage,
  Track
} from './types';
import {
  parseTrackMetadata,
  HF_CONFIG,
  SUPPORTED_AUDIO_EXTENSIONS,
  shuffleArray,
  getStreamableAudioUrl,
  isSafariBrowser,
  isSafariPlayable
} from './utils/audioUtils';
import { Storage } from './utils/storage';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MainView } from './components/MainView';
import { PlayerBar } from './components/PlayerBar';
import { QueueModal } from './components/QueueModal';
import { Toast } from './components/Toast';
import { CreatePlaylistModal } from './components/CreatePlaylistModal';
import { AddToPlaylistModal } from './components/AddToPlaylistModal';
import { AuthModal } from './components/AuthModal';
import { ExpandedNowPlayingModal } from './components/ExpandedNowPlayingModal';
import { InstallAppModal } from './components/InstallAppModal';
import {
  auth,
  logOutUser,
  FirebaseUser,
  subscribeToUserPlaylists,
  savePlaylistToFirestore,
  updatePlaylistTracksInFirestore,
  deletePlaylistFromFirestore,
} from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function App() {
  // Navigation & View States
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Firebase Auth State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // "Install App" (PWA) State
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    const installedHandler = () => setDeferredInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  // Maximized Full-Screen Player State
  const [isMaximizedPlayerOpen, setIsMaximizedPlayerOpen] = useState(false);
  const [maximizedInitialTab, setMaximizedInitialTab] = useState<'art' | 'lyrics'>('art');

  // Notifications Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Helper to add notification toasts
  const addToast = useCallback((message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Audio Tracks 
  const [tracks, setTracks] = useState<Track[]>([]);
  // AI-generated daily playlists (Punjabi Mix, Haryanvi Mix, Hindi Mix,
  // Love Mix...) — same for every visitor for the day, regenerated once
  // every 24h server-side.
  const [aiPlaylists, setAiPlaylists] = useState<AiPlaylist[]>([]);
  // 100-song Today's Mix state (shuffled once per session/tracks load, allowing removal)
  const [todaysMixTrackIds, setTodaysMixTrackIds] = useState<string[]>([]);
  useEffect(() => {
    if (tracks.length > 0 && todaysMixTrackIds.length === 0) {
      // Fill up to 100 tracks with random selection across passes
      const hundredTracks: Track[] = [];
      while (hundredTracks.length < 100 && tracks.length > 0) {
        const shuffledPass: Track[] = shuffleArray(tracks);
        for (const t of shuffledPass) {
          if (hundredTracks.length < 100) hundredTracks.push(t);
        }
      }
      setTodaysMixTrackIds(hundredTracks.map((t, idx) => `${t.id}_${idx}`));
    }
  }, [tracks]);

  // Construct actual track objects for Today's Mix
  const todaysMixTracks = useMemo(() => {
    return todaysMixTrackIds
      .map((compositeId) => {
        const originalId = compositeId.split('_')[0];
        const track = tracks.find((t) => t.id === originalId);
        if (!track) return null;
        // Ensure unique ID instance so removal targets exact entry
        return { ...track, instanceId: compositeId };
      })
      .filter((t): t is (Track & { instanceId: string }) => t !== null);
  }, [todaysMixTrackIds, tracks]);

  const handleRemoveFromTodaysMix = useCallback((instanceId: string) => {
    setTodaysMixTrackIds((prev) => prev.filter((id) => id !== instanceId));
    addToast('Removed song from Today\'s Mix', 'info');
  }, [addToast]);

  const [isLoadingHF, setIsLoadingHF] = useState(false);

  // Playlists & Local State
  const [playlists, setPlaylists] = useState<Playlist[]>(() => Storage.getCustomPlaylists());
  const [likedTrackIds, setLikedTrackIds] = useState<string[]>(() => Storage.getLikedTrackIds());

  // Player State
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState<number>(() => Storage.getVolume());
  const [isMuted, setIsMutedState] = useState<boolean>(() => Storage.getMuted());
  const [isShuffle, setIsShuffle] = useState(true);
  // Last few track ids played during smart shuffle, so it doesn't repeat
  // the same handful of songs back-to-back. A ref (not state) since it's
  // only read/written at track-transition time, never needs to re-render.
  const recentlyShuffledIdsRef = useRef<string[]>([]);
  // Stable shuffled play order — computed once when shuffle is switched on
  // (and reshuffled only after a full pass completes), instead of being
  // re-randomized on every render/re-shuffle-in-place.
  const [shuffledOrder, setShuffledOrder] = useState<Track[]>([]);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [userQueue, setUserQueue] = useState<Track[]>([]);
  const [isAutoplay, setIsAutoplay] = useState(true);

  // Playlist Modals State
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [addToPlaylistTrack, setAddToPlaylistTrack] = useState<Track | null>(null);

  // Audio Ref — rendered as a real DOM element below
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Chunked-streaming buffered progress (drives the grey "downloaded" bar)
  const [bufferedPercent, setBufferedPercent] = useState(0);

  // Auto-generated playlists: play counts & recently played (persisted locally)
  const [playCounts, setPlayCounts] = useState<Record<string, number>>(() => Storage.getPlayCounts());
  const [recentlyPlayedIds, setRecentlyPlayedIds] = useState<string[]>(() => Storage.getRecentlyPlayed());

  const trackPlayStart = useCallback((track: Track) => {
    setPlayCounts(Storage.incrementPlayCount(track.id));
    setRecentlyPlayedIds(Storage.addRecentlyPlayed(track.id));
  }, []);



  // Firebase Auth Observer & Real-time Playlist Listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  // Sync playlists from Firebase Firestore when logged in
  useEffect(() => {
    if (!user) {
      setPlaylists(Storage.getCustomPlaylists());
      return;
    }

    const unsubscribePlaylists = subscribeToUserPlaylists(
      user.uid,
      (remotePlaylists) => {
        setPlaylists(remotePlaylists);
        Storage.setCustomPlaylists(remotePlaylists);
      },
      (err) => {
        console.error('Failed to sync playlists from Firebase:', err);
      }
    );

    return () => unsubscribePlaylists();
  }, [user]);

  const handleLogOut = useCallback(async () => {
    try {
      await logOutUser();
      addToast('Logged out successfully', 'info');
    } catch (err: any) {
      addToast('Failed to log out', 'error');
    }
  }, [addToast]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Audio Ended Listener (Continuous Playback)
  const handleNextTrack = useCallback(() => {
    if (tracks.length === 0) return;

    let nextTrack: Track | null = null;

    if (userQueue.length > 0) {
      // Pop from queue
      nextTrack = userQueue[0];
      setUserQueue((prev) => prev.slice(1));
    } else if (isAutoplay) {
      // Random song from all tracks
      const randomIndex = Math.floor(Math.random() * tracks.length);
      nextTrack = tracks[randomIndex];
    } else {
      const currentIndex = tracks.findIndex((t) => t.id === currentTrack?.id);

      if (isShuffle) {
        // Smart shuffle: if the currently playing track belongs to one of
        // today's AI-generated mixes (Punjabi/Haryanvi/Hindi/Love), keep
        // shuffling within that same mix instead of the whole library, so
        // the next song stays contextually related to what's playing.
        const currentCluster = currentTrack
          ? aiPlaylists.find(
              (pl) => pl.tracks.length >= 2 && pl.tracks.some((t) => t.id === currentTrack.id)
            )
          : undefined;

        if (currentCluster) {
          const recent = recentlyShuffledIdsRef.current;
          let candidates = currentCluster.tracks.filter(
            (t) => t.id !== currentTrack?.id && !recent.includes(t.id)
          );
          if (candidates.length === 0) {
            // Exhausted this mix without repeats — allow repeats again,
            // just avoid immediately replaying the current track.
            candidates = currentCluster.tracks.filter((t) => t.id !== currentTrack?.id);
          }
          nextTrack =
            candidates.length > 0
              ? candidates[Math.floor(Math.random() * candidates.length)]
              : currentCluster.tracks[0];
        } else {
          // No AI mix match (or no Gemini key configured yet) — fall back
          // to the stable full-library shuffled order, advancing through
          // it rather than re-randomizing on every track change. Only
          // reshuffles (a fresh pass) once we've made it all the way
          // through the current one.
          const order = shuffledOrder.length > 0 ? shuffledOrder : tracks;
          const posInOrder = order.findIndex((t) => t.id === currentTrack?.id);
          const isLastInPass = posInOrder === -1 || posInOrder >= order.length - 1;
          if (isLastInPass) {
            const freshOrder: Track[] = shuffleArray(tracks);
            setShuffledOrder(freshOrder);
            nextTrack = freshOrder.length > 0 ? freshOrder[0] : null;
          } else {
            nextTrack = order[posInOrder + 1];
          }
        }

        if (nextTrack) {
          const recent = recentlyShuffledIdsRef.current;
          recentlyShuffledIdsRef.current = [nextTrack.id, ...recent].slice(0, 8);
        }
      } else {
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % tracks.length : 0;
        nextTrack = tracks[nextIndex];
      }
    }

    // Safari (iOS/macOS) has no decoder for .ogg or .flac at all, no matter
    // what headers the server sends — skip straight past those instead of
    // landing on a track that will silently fail to play.
    if (nextTrack && isSafariBrowser() && !isSafariPlayable(nextTrack.path)) {
      const playableTracks = tracks.filter((t) => isSafariPlayable(t.path));
      nextTrack = playableTracks.length > 0
        ? playableTracks[Math.floor(Math.random() * playableTracks.length)]
        : null;
    }

    if (nextTrack) {
      setCurrentTrack(nextTrack);
      trackPlayStart(nextTrack);
      setBufferedPercent(0);
      if (audioRef.current) {
        audioRef.current.src = getStreamableAudioUrl(nextTrack);
        audioRef.current.currentTime = 0;
        audioRef.current.load();
        audioRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
            document.title = `${nextTrack.title} • ${nextTrack.artist || 'Spotify'}`;
          })
          .catch((err) => {
            if (err?.name !== 'AbortError' && !err?.message?.includes('interrupted')) {
              console.error('Play next track error:', err);
            }
          });
      }
    }
  }, [tracks, currentTrack, isShuffle, shuffledOrder, userQueue, isAutoplay, trackPlayStart, aiPlaylists]);

  // Initialize HTML5 Audio Element event listeners
  // The <audio> element itself is rendered in the JSX below (required for iOS Safari)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleProgress = () => {
      try {
        if (audio.buffered.length > 0 && audio.duration) {
          const end = audio.buffered.end(audio.buffered.length - 1);
          setBufferedPercent(Math.min(100, (end / audio.duration) * 100));
        }
      } catch {
        // buffered ranges can throw briefly during src swaps — ignore
      }
    };

    const handleAudioError = (e: Event) => {
      console.error('Audio playback error:', e);
      addToast('Error loading audio stream. Skipping to next track...', 'error');
      setIsPlaying(false);
      setTimeout(() => {
        handleNextTrack();
      }, 1500);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('progress', handleProgress);
    audio.addEventListener('error', handleAudioError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('progress', handleProgress);
      audio.removeEventListener('error', handleAudioError);
    };
  }, [addToast, handleNextTrack]);

  // Audio Ended Listener
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (repeatMode === 'one' && currentTrack) {
        audio.currentTime = 0;
        audio.play().catch((err) => {
          if (err?.name !== 'AbortError' && !err?.message?.includes('interrupted')) {
            console.error('Repeat play error:', err);
          }
        });
      } else {
        handleNextTrack();
      }
    };

    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentTrack, repeatMode, isShuffle, tracks, handleNextTrack]);

  // Sync Volume & Mute with Audio Element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Save Last Played Track position periodically
  useEffect(() => {
    if (currentTrack && currentTime > 0) {
      Storage.setLastPlayed(currentTrack.id, currentTime);
    }
  }, [currentTrack, currentTime]);

  // Fetch Hugging Face Dataset Tree & Apply Strict Poster / Metadata Rules
  const fetchHFMusicLibrary = useCallback(async (isRetry = false) => {
    setIsLoadingHF(true);

    try {
      const response = await fetch(
        `/api/hf-tree?user=${encodeURIComponent(HF_CONFIG.HF_USER)}&repo=${encodeURIComponent(HF_CONFIG.HF_REPO)}`
      );

      if (!response.ok) {
        // Transient blip (cold start, brief HF hiccup)? Try once more
        // silently before bothering the user with an error toast.
        if (!isRetry) {
          setTimeout(() => fetchHFMusicLibrary(true), 1500);
          return;
        }
        const errBody = await response.json().catch(() => null);
        addToast(
          errBody?.error
            ? `Couldn't load your library: ${errBody.error}`
            : "Couldn't load your music library right now. Try refreshing.",
          'error'
        );
        setTracks([]);
        setIsLoadingHF(false);
        return;
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        const audioFiles = data.filter((item: any) => {
          if (item.type !== 'file' || !item.path) return false;
          const ext = item.path.substring(item.path.lastIndexOf('.')).toLowerCase();
          return SUPPORTED_AUDIO_EXTENSIONS.includes(ext);
        });

        if (audioFiles.length > 0) {
          const hfTracks: Track[] = audioFiles.map((file: any) => {
            const metadata = parseTrackMetadata(file.path);

            return {
              id: `hf_${HF_CONFIG.HF_USER}_${HF_CONFIG.HF_REPO}_${file.path}`,
              path: file.path,
              title: metadata.title,
              artist: metadata.artist,
              album: 'Single',
              duration: 210,
              audioUrl: metadata.audioUrl,
              gradientColors: ['#1DB954', '#121212'] as [string, string],
              coverArtUrl: metadata.posterUrl,
              size: file.size,
              source: 'hf',
              dateAdded: 'Recently',
            };
          });

          setTracks(hfTracks);
        } else {
          setTracks([]);
        }
      } else {
        // The endpoint always returns 200, but on failure the body is
        // { error, tracks: [] } instead of an array. Treat that the same
        // way an HTTP error used to be treated: retry once, then tell
        // the user what actually happened instead of just going quiet.
        if (data && typeof data === 'object' && 'error' in data) {
          if (!isRetry) {
            setTimeout(() => fetchHFMusicLibrary(true), 1500);
            return;
          }
          addToast(`Couldn't load your library: ${data.error}`, 'error');
        }
        setTracks([]);
      }
    } catch (err: any) {
      if (!isRetry) {
        setTimeout(() => fetchHFMusicLibrary(true), 1500);
        return;
      }
      console.warn('Hugging Face dataset offline or empty:', err?.message || err);
      addToast("Couldn't reach your music library. Check your connection and try refreshing.", 'error');
      setTracks([]);
    } finally {
      setIsLoadingHF(false);
    }
  }, [addToast]);

  // Mount Fetch
  useEffect(() => {
    fetchHFMusicLibrary();
  }, [fetchHFMusicLibrary]);

  // Shuffle defaults to on, so seed the stable shuffled order as soon as
  // the library loads — otherwise it'd stay empty until the user manually
  // toggled shuffle off and back on.
  useEffect(() => {
    if (isShuffle && tracks.length > 0 && shuffledOrder.length === 0) {
      setShuffledOrder(shuffleArray(tracks));
    }
  }, [isShuffle, tracks, shuffledOrder.length]);

  // Fetch AI-Generated Daily Playlists
  // (Punjabi Mix / Haryanvi Mix / Hindi Mix / Love Mix, etc. — server picks
  // and caches these once per day; every visitor sees the same set.)
  const [rawAiPlaylists, setRawAiPlaylists] = useState<
    { id: string; name: string; emoji: string; description: string; paths: string[] }[]
  >([]);

  useEffect(() => {
    const geminiKey = Storage.getGeminiKey();
    fetch('/api/ai-playlists', {
      headers: geminiKey ? { 'x-gemini-key': geminiKey } : undefined,
    })
      .then((res) => (res.ok ? res.json() : { playlists: [] }))
      .then((data) => setRawAiPlaylists(Array.isArray(data?.playlists) ? data.playlists : []))
      .catch(() => setRawAiPlaylists([]));
  }, []);

  // Resolve each AI playlist's file paths against the loaded track library.
  // Re-runs whenever the library or the raw AI playlist data changes.
  useEffect(() => {
    if (tracks.length === 0 || rawAiPlaylists.length === 0) {
      setAiPlaylists([]);
      return;
    }
    const byPath = new Map(tracks.map((t) => [t.path, t]));
    const resolved: AiPlaylist[] = rawAiPlaylists
      .map((p) => ({
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        description: p.description,
        tracks: p.paths.map((path) => byPath.get(path)).filter((t): t is Track => Boolean(t)),
      }))
      .filter((p) => p.tracks.length > 0);
    setAiPlaylists(resolved);
  }, [tracks, rawAiPlaylists]);

  // Restore Last Played Track from Storage
  useEffect(() => {
    const lastPlayed = Storage.getLastPlayed();
    if (lastPlayed && tracks.length > 0) {
      const track = tracks.find((t) => t.id === lastPlayed.trackId);
      if (track) {
        setCurrentTrack(track);
        if (audioRef.current) {
          audioRef.current.src = getStreamableAudioUrl(track);
        }
      }
    } else if (tracks.length > 0 && !currentTrack) {
      setCurrentTrack(tracks[0]);
    }
  }, [tracks]);

  // Helper to check if error is a benign audio play interruption
  const isBenignPlayError = (err: any) => {
    return (
      err?.name === 'AbortError' ||
      err?.message?.includes('interrupted') ||
      err?.message?.includes('pause') ||
      err?.message?.includes('removed')
    );
  };

  // Play Specific Track
  const handlePlayTrack = useCallback(
    (track: Track, customQueue?: Track[]) => {
      const audio = audioRef.current;
      if (!audio) return;

      let willPlay = false;

      if (currentTrack?.id === track.id) {
        if (isPlaying) {
          audio.pause();
          setIsPlaying(false);
        } else {
          audio
            .play()
            .then(() => {
              setIsPlaying(true);
            })
            .catch((err) => {
              if (!isBenignPlayError(err)) {
                console.error('Play failed:', err);
                addToast('Error starting audio playback.', 'error');
              }
            });
          willPlay = true;
        }
      } else if (isSafariBrowser() && !isSafariPlayable(track.path)) {
        // Safari has no decoder for .ogg/.flac on any platform — bail out
        // with a clear message instead of loading a track that will never
        // actually play.
        addToast(`"${track.title}" isn't a format Safari can play. Try it in Chrome instead.`, 'error');
        return;
      } else {
        setCurrentTrack(track);
        trackPlayStart(track);
        setBufferedPercent(0);
        audio.src = getStreamableAudioUrl(track);
        audio.currentTime = 0;
        
        if (customQueue && customQueue.length > 0) {
          const trackIdx = customQueue.findIndex((t) => t.id === track.id);
          if (trackIdx !== -1) {
            setUserQueue(customQueue.slice(trackIdx + 1));
          }
        }

        audio.load();
        audio
          .play()
          .then(() => {
            setIsPlaying(true);
            document.title = `${track.title} • ${track.artist || 'Spotify'}`;
          })
          .catch((err) => {
            if (!isBenignPlayError(err)) {
              console.error('Playback failed:', err);
              addToast(`Failed to play ${track.title}.`, 'error');
            }
            setIsPlaying(false);
          });
        willPlay = true;
      }

      if (willPlay) {
        setMaximizedInitialTab('art');
        setIsMaximizedPlayerOpen(true);
      }
    },
    [currentTrack, isPlaying, addToast, trackPlayStart]
  );

  const handleAddToQueue = useCallback((track: Track) => {
    setUserQueue((prev) => [...prev, track]);
    addToast(`Added ${track.title} to queue`, 'success');
  }, [addToast]);

  // Play / Pause Toggle
  const handleTogglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrack && tracks.length > 0) {
      handlePlayTrack(tracks[0]);
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          if (!isBenignPlayError(err)) {
            console.error('Play error:', err);
            addToast('Playback blocked or failed.', 'error');
          }
        });
    }
  }, [currentTrack, isPlaying, tracks, handlePlayTrack, addToast]);

  // Previous Track Logic
  const handlePrevTrack = useCallback(() => {
    if (tracks.length === 0) return;

    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }

    const currentIndex = tracks.findIndex((t) => t.id === currentTrack?.id);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : tracks.length - 1;
    handlePlayTrack(tracks[prevIndex]);
  }, [tracks, currentTrack, handlePlayTrack]);

  // Seek Progress
  const handleSeek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    setCurrentTime(time);
  }, []);

  // Volume Change
  const handleVolumeChange = useCallback((newVol: number) => {
    setVolumeState(newVol);
    Storage.setVolume(newVol);
    if (isMuted && newVol > 0) {
      setIsMutedState(false);
      Storage.setMuted(false);
    }
  }, [isMuted]);

  // Toggle Mute
  const handleToggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMutedState(nextMuted);
    Storage.setMuted(nextMuted);
  }, [isMuted]);

  // Toggle Shuffle & Repeat Modes
  const handleToggleShuffle = useCallback(() => {
    setIsShuffle((prev) => {
      const nextShuffle = !prev;
      if (nextShuffle) {
        setShuffledOrder(shuffleArray(tracks));
        recentlyShuffledIdsRef.current = [];
        setIsQueueOpen(true);
        addToast('Shuffle On — Opening Up Next Queue', 'info');
      } else {
        addToast('Shuffle Off', 'info');
      }
      return nextShuffle;
    });
  }, [addToast, tracks]);

  const handleToggleRepeat = useCallback(() => {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const nextIndex = (modes.indexOf(repeatMode) + 1) % modes.length;
    const nextMode = modes[nextIndex];
    setRepeatMode(nextMode);
    addToast(`Repeat: ${nextMode.toUpperCase()}`, 'info');
  }, [repeatMode, addToast]);

  // Toggle Favorite / Liked Song
  const handleToggleLike = useCallback((trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = Storage.toggleLikedTrack(trackId);
    setLikedTrackIds(updated);
    const isNowLiked = updated.includes(trackId);
    addToast(isNowLiked ? 'Saved to Liked Songs' : 'Removed from Liked Songs', 'info');
  }, [addToast]);

  // Create Custom Playlist
  const handleCreatePlaylist = useCallback(
    async (name: string, description?: string) => {
      const newPlaylist: Playlist = {
        id: `pl_${Date.now()}`,
        name,
        description: description || 'Custom User Playlist',
        gradient: 'from-[#1DB954] to-teal-800',
        trackIds: [],
        isCustom: true,
      };

      if (user) {
        try {
          await savePlaylistToFirestore(user.uid, newPlaylist);
          addToast(`Playlist "${name}" saved to Firebase!`, 'success');
        } catch (err) {
          console.error('Error saving to Firebase:', err);
          addToast(`Failed to save playlist to Firebase.`, 'error');
        }
      } else {
        const updated = [...playlists, newPlaylist];
        setPlaylists(updated);
        Storage.setCustomPlaylists(updated);
        addToast(`Created playlist "${name}" locally! Log in to save to Firebase.`, 'info');
      }

      setActivePlaylistId(newPlaylist.id);
      setActiveTab('playlist');
    },
    [user, playlists, addToast]
  );

  // Toggle Track in Custom Playlist
  const handleToggleTrackInPlaylist = useCallback(
    async (trackId: string, playlistId: string) => {
      let plName = '';
      let isAdded = false;
      let newTrackIds: string[] = [];
      const targetTrack = tracks.find((t) => t.id === trackId);

      const updated = playlists.map((pl) => {
        if (pl.id === playlistId) {
          plName = pl.name;
          const exists = pl.trackIds.includes(trackId);
          isAdded = !exists;
          newTrackIds = exists
            ? pl.trackIds.filter((id) => id !== trackId)
            : [...pl.trackIds, trackId];
          return { ...pl, trackIds: newTrackIds };
        }
        return pl;
      });

      setPlaylists(updated);
      Storage.setCustomPlaylists(updated);

      if (user) {
        try {
          await updatePlaylistTracksInFirestore(user.uid, playlistId, newTrackIds);
        } catch (err) {
          console.error('Error updating playlist in Firebase:', err);
        }
      }

      if (targetTrack) {
        if (isAdded) {
          addToast(`Added "${targetTrack.title}" to ${plName}`, 'success');
        } else {
          addToast(`Removed "${targetTrack.title}" from ${plName}`, 'info');
        }
      }
    },
    [user, playlists, tracks, addToast]
  );

  // Remove Track from Playlist
  const handleRemoveTrackFromPlaylist = useCallback(
    (trackId: string, playlistId: string) => {
      handleToggleTrackInPlaylist(trackId, playlistId);
    },
    [handleToggleTrackInPlaylist]
  );

  // Delete Custom Playlist
  const handleDeletePlaylist = useCallback(
    async (playlistId: string) => {
      const pl = playlists.find((p) => p.id === playlistId);
      const updated = playlists.filter((p) => p.id !== playlistId);
      setPlaylists(updated);
      Storage.setCustomPlaylists(updated);

      if (user) {
        try {
          await deletePlaylistFromFirestore(user.uid, playlistId);
        } catch (err) {
          console.error('Error deleting playlist from Firebase:', err);
        }
      }

      if (activePlaylistId === playlistId) {
        setActivePlaylistId(null);
        setActiveTab('library');
      }
      addToast(`Deleted playlist "${pl?.name || ''}"`, 'info');
    },
    [user, playlists, activePlaylistId, addToast]
  );

  // Select Active Playlist
  const handleSelectPlaylist = useCallback((playlistId: string) => {
    setActivePlaylistId(playlistId);
    setActiveTab('playlist');
  }, []);

  // Keyboard Shortcuts (Space, Arrows, M)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlayPause();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (audioRef.current) {
          handleSeek(Math.min(audioRef.current.currentTime + 5, duration));
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (audioRef.current) {
          handleSeek(Math.max(audioRef.current.currentTime - 5, 0));
        }
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleTogglePlayPause, handleSeek, handleToggleMute, duration]);

  // Stable "Up Next" list for the Queue modal — derived from the one
  // pre-shuffled order (not recomputed/re-randomized on every render).
  const upNextQueue = useMemo(() => {
    const rest = (isShuffle && shuffledOrder.length > 0 ? shuffledOrder : tracks).filter(
      (t) => t.id !== currentTrack?.id
    );
    return rest;
  }, [isShuffle, shuffledOrder, tracks, currentTrack]);

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-white font-sans overflow-hidden select-none">
      <audio
        ref={audioRef}
        playsInline
        preload="auto"
        style={{ display: 'none' }}
      />
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          likedCount={likedTrackIds.length}
          playlists={playlists}
          onRequestCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
          activePlaylistId={activePlaylistId}
          setActivePlaylistId={setActivePlaylistId}
        />

        <div className="flex-1 flex flex-col min-w-0 bg-[#121212] overflow-hidden">
          <Header
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            user={user}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onLogOut={handleLogOut}
            onOpenInstallModal={() => setIsInstallModalOpen(true)}
            onOpenAdmin={() => setActiveTab('admin')}
          />

          <MainView
            activeTab={activeTab}
            tracks={tracks}
            isLoadingHF={isLoadingHF}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            likedTrackIds={likedTrackIds}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onPlayTrack={(track, customQueue) => {
              handlePlayTrack(track, customQueue);
            }}
            onToggleLike={handleToggleLike}
            playlists={playlists}
            activePlaylistId={activePlaylistId}
            onRequestCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
            onAddToPlaylist={(track) => setAddToPlaylistTrack(track)}
            onAddToQueue={(track) => {
              setUserQueue((prev) => [...prev, track]);
              addToast(`Added "${track.title}" to Queue`, 'success');
            }}
            onRemoveFromPlaylist={handleRemoveTrackFromPlaylist}
            onDeletePlaylist={handleDeletePlaylist}
            onSelectPlaylist={(id) => {
              setActivePlaylistId(id);
              setActiveTab('playlist');
            }}
            onSeek={handleSeek}
            onPlayPause={handleTogglePlayPause}
            playCounts={playCounts}
            recentlyPlayedIds={recentlyPlayedIds}
            onRefreshLibrary={fetchHFMusicLibrary}
            addToast={addToast}
            todaysMixTracks={todaysMixTracks}
            onRemoveFromTodaysMix={handleRemoveFromTodaysMix}
            aiPlaylists={aiPlaylists}
          />
        </div>
      </div>

      <PlayerBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        bufferedPercent={bufferedPercent}
        volume={volume}
        isMuted={isMuted}
        isShuffle={isShuffle}
        repeatMode={repeatMode}
        isLiked={currentTrack ? likedTrackIds.includes(currentTrack.id) : false}
        activeTab={activeTab}
        onPlayPause={handleTogglePlayPause}
        onPrevTrack={handlePrevTrack}
        onNextTrack={handleNextTrack}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onToggleMute={handleToggleMute}
        onToggleShuffle={handleToggleShuffle}
        onToggleRepeat={handleToggleRepeat}
        onToggleLike={handleToggleLike}
        onOpenQueue={() => setIsQueueOpen(true)}
        onToggleLyrics={() => {
          setMaximizedInitialTab('lyrics');
          setIsMaximizedPlayerOpen(true);
        }}
        onOpenMaximizedPlayer={(tab) => {
          setMaximizedInitialTab(tab || 'art');
          setIsMaximizedPlayerOpen(true);
        }}
      />

      {/* Maximized Full-Screen Player Modal */}
      <ExpandedNowPlayingModal
        isOpen={isMaximizedPlayerOpen}
        onClose={() => setIsMaximizedPlayerOpen(false)}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        bufferedPercent={bufferedPercent}
        volume={volume}
        isMuted={isMuted}
        isShuffle={isShuffle}
        repeatMode={repeatMode}
        isLiked={currentTrack ? likedTrackIds.includes(currentTrack.id) : false}
        initialTab={maximizedInitialTab}
        onPlayPause={handleTogglePlayPause}
        onPrevTrack={handlePrevTrack}
        onNextTrack={handleNextTrack}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onToggleMute={handleToggleMute}
        onToggleShuffle={handleToggleShuffle}
        onToggleRepeat={handleToggleRepeat}
        onToggleLike={handleToggleLike}
        onOpenQueue={() => setIsQueueOpen(true)}
        userQueue={userQueue}
        isAutoplay={isAutoplay}
        onToggleAutoplay={() => setIsAutoplay(!isAutoplay)}
        onRemoveFromQueue={(index) => setUserQueue((prev) => prev.filter((_, i) => i !== index))}
        onPlayTrack={handlePlayTrack}
      />

      {/* Queue Drawer Modal */}
      <QueueModal
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        queue={upNextQueue}
        userQueue={userQueue}
        currentTrack={currentTrack}
        onPlayTrack={(track) => {
          handlePlayTrack(track);
          setIsQueueOpen(false);
        }}
        isAutoplay={isAutoplay}
        onToggleAutoplay={() => setIsAutoplay(!isAutoplay)}
        onRemoveFromQueue={(index) => setUserQueue((prev) => prev.filter((_, i) => i !== index))}
        isShuffle={isShuffle}
      />

      {/* Create Custom Playlist Modal */}
      <CreatePlaylistModal
        isOpen={isCreatePlaylistOpen}
        onClose={() => setIsCreatePlaylistOpen(false)}
        onCreatePlaylist={handleCreatePlaylist}
      />

      {/* Add Track to Playlist Modal */}
      <AddToPlaylistModal
        isOpen={!!addToPlaylistTrack}
        onClose={() => setAddToPlaylistTrack(null)}
        track={addToPlaylistTrack}
        playlists={playlists}
        onToggleTrackInPlaylist={handleToggleTrackInPlaylist}
        onCreateNewPlaylist={() => setIsCreatePlaylistOpen(true)}
      />

      {/* Firebase Auth Login / Signup Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccessToast={(msg) => addToast(msg, 'success')}
      />

      {/* Install App (PWA) Modal */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        deferredPrompt={deferredInstallPrompt}
        onInstalled={() => {
          addToast('App installed! Check your home screen or app list.', 'success');
          setDeferredInstallPrompt(null);
        }}
      />
    </div>
  );
}
