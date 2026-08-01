import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActiveTab,
  Playlist,
  RepeatMode,
  ToastMessage,
  Track
} from './types';
import {
  parseTrackMetadata,
  HF_CONFIG,
  SUPPORTED_AUDIO_EXTENSIONS
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
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Maximized Full-Screen Player State
  const [isMaximizedPlayerOpen, setIsMaximizedPlayerOpen] = useState(false);
  const [maximizedInitialTab, setMaximizedInitialTab] = useState<'art' | 'lyrics'>('art');

  // Audio Tracks State
  const [tracks, setTracks] = useState<Track[]>([]);
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
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [userQueue, setUserQueue] = useState<Track[]>([]);
  const [isAutoplay, setIsAutoplay] = useState(false);

  // Playlist Modals State
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [addToPlaylistTrack, setAddToPlaylistTrack] = useState<Track | null>(null);

  // Notifications Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Audio Ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Helper to add notification toasts
  const addToast = useCallback((message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
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
      let nextIndex = 0;
      const currentIndex = tracks.findIndex((t) => t.id === currentTrack?.id);

      if (isShuffle) {
        nextIndex = Math.floor(Math.random() * tracks.length);
      } else {
        nextIndex = currentIndex >= 0 ? (currentIndex + 1) % tracks.length : 0;
      }
      nextTrack = tracks[nextIndex];
    }

    if (nextTrack) {
      setCurrentTrack(nextTrack);
      if (audioRef.current) {
        audioRef.current.src = nextTrack.audioUrl;
        audioRef.current.currentTime = 0;
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
  }, [tracks, currentTrack, isShuffle, userQueue, isAutoplay]);

  // Initialize HTML5 Audio Element
  useEffect(() => {
    if (!audioRef.current) {
      const newAudio = new Audio();
      newAudio.preload = 'metadata';
      audioRef.current = newAudio;
    }
    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
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
    audio.addEventListener('error', handleAudioError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
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
  const fetchHFMusicLibrary = useCallback(async () => {
    setIsLoadingHF(true);

    try {
      const response = await fetch(
        `/api/hf-tree?user=${encodeURIComponent(HF_CONFIG.HF_USER)}&repo=${encodeURIComponent(HF_CONFIG.HF_REPO)}`
      );

      let data: any[] = [];
      if (response && response.ok) {
        data = await response.json();
      }

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

          const combined = hfTracks;
          setTracks(combined);
        } else {
          setTracks([]);
        }
      } else {
        setTracks([]);
      }
    } catch (err: any) {
      console.warn('Hugging Face dataset offline or empty:', err?.message || err);
      setTracks([]);
    } finally {
      setIsLoadingHF(false);
    }
  }, []);

  // Mount Fetch
  useEffect(() => {
    fetchHFMusicLibrary();
  }, [fetchHFMusicLibrary]);

  // Restore Last Played Track from Storage
  useEffect(() => {
    const lastPlayed = Storage.getLastPlayed();
    if (lastPlayed && tracks.length > 0) {
      const track = tracks.find((t) => t.id === lastPlayed.trackId);
      if (track) {
        setCurrentTrack(track);
        if (audioRef.current) {
          audioRef.current.src = track.audioUrl;
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
    (track: Track) => {
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
      } else {
        setCurrentTrack(track);
        audio.src = track.audioUrl;
        audio.currentTime = 0;
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
    [currentTrack, isPlaying, addToast]
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
    setIsShuffle((prev) => !prev);
    addToast(isShuffle ? 'Shuffle Off' : 'Shuffle On', 'info');
  }, [isShuffle, addToast]);

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

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-white font-sans overflow-hidden select-none">
      {/* Toast Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          likedCount={likedTrackIds.length}
          playlists={playlists}
          onRequestCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
          activePlaylistId={activePlaylistId}
          setActivePlaylistId={setActivePlaylistId}
        />

        {/* Content View Area */}
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
            onPlayTrack={handlePlayTrack}
            onToggleLike={handleToggleLike}
            playlists={playlists}
            activePlaylistId={activePlaylistId}
            onRequestCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
            onAddToPlaylist={(track) => setAddToPlaylistTrack(track)}
            onRemoveFromPlaylist={handleRemoveTrackFromPlaylist}
            onDeletePlaylist={handleDeletePlaylist}
            onSelectPlaylist={handleSelectPlaylist}
            onSeek={handleSeek}
            onPlayPause={handleTogglePlayPause}
          />
        </div>
      </div>

      {/* Bottom Persistent Player Bar */}
      <PlayerBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
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
        queue={tracks.filter((t) => t.id !== currentTrack?.id)}
        userQueue={userQueue}
        currentTrack={currentTrack}
        onPlayTrack={(track) => {
          handlePlayTrack(track);
          setIsQueueOpen(false);
        }}
        isAutoplay={isAutoplay}
        onToggleAutoplay={() => setIsAutoplay(!isAutoplay)}
        onRemoveFromQueue={(index) => setUserQueue((prev) => prev.filter((_, i) => i !== index))}
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
