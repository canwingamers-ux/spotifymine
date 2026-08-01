import React, { useMemo, useState } from 'react';
import {
  Play,
  Heart,
  Grid,
  List,
  Music,
  Search,
  Folder,
  Plus,
  Trash2,
  FolderPlus,
  Sparkles,
  History,
} from 'lucide-react';
import { ActiveTab, Playlist, Track } from '../types';
import { TrackCard } from './TrackCard';
import { TrackTable } from './TrackTable';
import { LyricsView } from './LyricsView';
import { AdminPanel } from './AdminPanel';
import { getGreeting, shuffleArray } from '../utils/audioUtils';

interface MainViewProps {
  activeTab: ActiveTab;
  tracks: Track[];
  isLoadingHF?: boolean;
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime?: number;
  likedTrackIds: string[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onPlayTrack: (track: Track) => void;
  onToggleLike: (trackId: string, e: React.MouseEvent) => void;
  playlists: Playlist[];
  activePlaylistId: string | null;
  onRequestCreatePlaylist: () => void;
  onAddToPlaylist: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onRemoveFromPlaylist: (trackId: string, playlistId: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onSelectPlaylist: (playlistId: string) => void;
  onSeek?: (time: number) => void;
  onPlayPause?: () => void;
  playCounts?: Record<string, number>;
  recentlyPlayedIds?: string[];
  onRefreshLibrary?: () => void;
  addToast?: (message: string, type?: 'info' | 'error' | 'success') => void;
  todaysMixTracks?: (Track & { instanceId: string })[];
  onRemoveFromTodaysMix?: (instanceId: string) => void;
}

export const MainView: React.FC<MainViewProps> = ({
  activeTab,
  tracks,
  isLoadingHF = false,
  currentTrack,
  isPlaying,
  currentTime = 0,
  likedTrackIds,
  searchQuery,
  onPlayTrack,
  onToggleLike,
  playlists,
  activePlaylistId,
  onRequestCreatePlaylist,
  onAddToPlaylist,
  onAddToQueue,
  onRemoveFromPlaylist,
  onDeletePlaylist,
  onSelectPlaylist,
  onSeek = () => {},
  onPlayPause = () => {},
  playCounts = {},
  recentlyPlayedIds = [],
  onRefreshLibrary = () => {},
  addToast = () => {},
  todaysMixTracks = [],
  onRemoveFromTodaysMix = (_id: string) => {},
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isViewingTodaysMix, setIsViewingTodaysMix] = useState(false);
  const greeting = getGreeting();

  // Filter tracks by search query if present
  const filteredTracks = searchQuery.trim()
    ? tracks.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.album.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tracks;

  // Randomized track order for the home page — reshuffled every time the
  // library loads (i.e. every time the app is opened), never alphabetical.
  const shuffledTracks = useMemo(() => shuffleArray(tracks), [tracks]);

  const displayMixTracks = useMemo(() => {
    if (todaysMixTracks && todaysMixTracks.length > 0) return todaysMixTracks;
    return tracks.slice(0, 100).map((t, idx) => ({ ...t, instanceId: `${t.id}_${idx}` }));
  }, [todaysMixTracks, tracks]);

  // Recommended tracks for Home page ("Songs You Might Like" - 20-30 tracks)
  const recommendedTracks = useMemo(() => shuffleArray(tracks).slice(0, 24), [tracks]);

  const recentlyPlayedTracks = useMemo(() => {
    return recentlyPlayedIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((t): t is Track => !!t)
      .slice(0, 12);
  }, [tracks, recentlyPlayedIds]);

  // Liked tracks list
  const likedTracks = tracks.filter((t) => likedTrackIds.includes(t.id));

  // Active custom playlist
  const activePlaylist = playlists.find((p) => p.id === activePlaylistId);
  const playlistTracks = activePlaylist
    ? tracks.filter((t) => activePlaylist.trackIds.includes(t.id))
    : [];

  // Tracks not yet in active playlist (for quick recommendation adding)
  const availableTracksToAdd = activePlaylist
    ? tracks.filter((t) => !activePlaylist.trackIds.includes(t.id)).slice(0, 8)
    : [];

  return (
    <main className="flex-1 overflow-y-auto pb-36 md:pb-28 px-4 sm:px-6 pt-4 custom-scrollbar select-none bg-gradient-to-b from-zinc-900 via-[#121212] to-[#121212]">
      {activeTab === 'home' && !activePlaylistId && !isViewingTodaysMix && (
        <div className="space-y-10 animate-in fade-in duration-500">

          {/* ── GREETING ── */}
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-1">
              {greeting}
            </h1>
            <p className="text-sm text-zinc-500 font-medium">What sounds good today?</p>
          </div>

          {/* ── TODAY'S MIX — big featured playlist card ── */}
          {(displayMixTracks.length > 0 || tracks.length > 0) && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#1DB954]" />
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Today's Mix</h2>
                  <span
                    className="text-[11px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(29,185,84,0.15)', color: '#1DB954', border: '1px solid rgba(29,185,84,0.3)' }}
                  >
                    {displayMixTracks.length || 100} Songs
                  </span>
                </div>
                <button
                  onClick={() => setIsViewingTodaysMix(true)}
                  className="text-xs font-bold text-[#1DB954] hover:underline"
                >
                  View All 100 →
                </button>
              </div>

              {/* Big playlist card */}
              <div
                onClick={() => setIsViewingTodaysMix(true)}
                className="group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-500 hover:scale-[1.01]"
                style={{
                  background: 'linear-gradient(135deg, rgba(29,185,84,0.22) 0%, rgba(16,185,129,0.10) 40%, rgba(9,9,11,0.95) 100%)',
                  border: '1px solid rgba(29,185,84,0.25)',
                  boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
                }}
              >
                {/* Background ambient glow */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                  style={{ background: 'radial-gradient(ellipse 60% 60% at 30% 50%, rgba(29,185,84,0.18), transparent)' }}
                />

                <div className="relative flex items-center gap-5 p-5 sm:p-6">
                  {/* Cover art collage – 2x2 grid of track thumbnails */}
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden shrink-0 grid grid-cols-2 gap-0.5 shadow-2xl" style={{ boxShadow: '0 0 30px rgba(29,185,84,0.25)' }}>
                    {displayMixTracks.slice(0, 4).map((t, i) => (
                      <img
                        key={i}
                        src={t.coverArtUrl || ''}
                        alt=""
                        className="w-full h-full object-cover"
                        style={{ background: 'rgba(255,255,255,0.05)' }}
                        onError={e => { e.currentTarget.style.background = '#18181b'; }}
                      />
                    ))}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-widest mb-1 text-[#1DB954]">Featured 100-Song Playlist</p>
                    <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-1">Today's Mix</h3>
                    <p className="text-sm text-zinc-300 mb-3">{displayMixTracks.length || 100} custom tracks · Tap to view, play & delete songs</p>
                    <div className="flex flex-wrap gap-1.5">
                      {displayMixTracks.slice(0, 4).map((t, i) => (
                        <span key={t.instanceId || i} className="text-[11px] text-zinc-400 font-medium">{t.artist}</span>
                      ))}
                      {displayMixTracks.length > 4 && <span className="text-[11px] text-zinc-500">& more</span>}
                    </div>
                  </div>

                  {/* Play button */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (displayMixTracks.length > 0) {
                        onPlayTrack(displayMixTracks[0], displayMixTracks);
                      }
                    }}
                    className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 shadow-2xl transition-all duration-300 opacity-90 group-hover:opacity-100 group-hover:scale-110 active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #1DB954, #1ed760)', boxShadow: '0 4px 20px rgba(29,185,84,0.5)' }}
                    title="Play Today's Mix in Order"
                  >
                    <Play className="w-7 h-7 fill-black text-black translate-x-0.5" />
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ── RECENTLY PLAYED ── */}
          {recentlyPlayedTracks.length > 0 && (
            <MixRow
              title="Recently Played"
              icon={<History className="w-4 h-4 text-[#1DB954]" />}
              tracks={recentlyPlayedTracks}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              likedTrackIds={likedTrackIds}
              onPlayTrack={onPlayTrack}
              onToggleLike={onToggleLike}
              onAddToPlaylist={onAddToPlaylist}
              onAddToQueue={onAddToQueue}
            />
          )}

          {/* ── SONGS YOU MIGHT LIKE (20-30 tracks grid) ── */}
          {recommendedTracks.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Music className="w-5 h-5 text-[#1DB954]" />
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    Songs You Might Like
                  </h2>
                </div>
                <span className="text-xs text-zinc-500 font-medium">
                  {recommendedTracks.length} recommendations
                </span>
              </div>

              {isLoadingHF ? (
                <div className="py-12 text-center text-zinc-400">
                  <Sparkles className="w-8 h-8 animate-spin mx-auto text-[#1DB954] mb-2" />
                  <p className="text-sm font-semibold">Loading recommendations...</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                  {recommendedTracks.map((track) => (
                    <TrackCard
                      key={track.id}
                      track={track}
                      isPlaying={isPlaying}
                      isCurrentTrack={currentTrack?.id === track.id}
                      isLiked={likedTrackIds.includes(track.id)}
                      onPlay={onPlayTrack}
                      onToggleLike={onToggleLike}
                      onAddToPlaylist={onAddToPlaylist}
                      onAddToQueue={onAddToQueue}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── QUICK ACTION: Create Playlist ── */}
          <div
            onClick={onRequestCreatePlaylist}
            className="group flex items-center gap-4 rounded-2xl p-4 cursor-pointer transition-all duration-300 hover:scale-[1.01]"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px dashed rgba(29,185,84,0.30)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(29,185,84,0.06)'; e.currentTarget.style.borderColor = 'rgba(29,185,84,0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(29,185,84,0.30)'; }}
          >
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110"
              style={{ background: 'rgba(29,185,84,0.12)' }}
            >
              <Plus className="w-7 h-7" style={{ color: '#1DB954' }} />
            </div>
            <div>
              <p className="font-bold text-white text-base">Create a Playlist</p>
              <p className="text-xs" style={{ color: '#52525b' }}>Build your own custom mix</p>
            </div>
            <div className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: '#1DB954' }}
              >
                <Plus className="w-4 h-4 text-black" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- TODAY'S MIX FULL PLAYLIST VIEW ----------------- */}
      {isViewingTodaysMix && !activePlaylistId && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6 bg-gradient-to-b from-emerald-900/80 via-zinc-950/40 to-transparent p-6 -mx-4 sm:-mx-6 -mt-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
              <div className="w-36 h-36 sm:w-48 sm:h-48 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-700 to-green-900 flex items-center justify-center shadow-2xl shrink-0 overflow-hidden grid grid-cols-2 p-1 gap-1">
                {displayMixTracks.slice(0, 4).map((t, i) => (
                  <img key={i} src={t.coverArtUrl || ''} alt="" className="w-full h-full object-cover rounded" />
                ))}
              </div>

              <div className="flex flex-col gap-2 text-center sm:text-left">
                <button
                  onClick={() => setIsViewingTodaysMix(false)}
                  className="text-xs font-bold text-[#1DB954] hover:underline self-start mb-1 flex items-center gap-1"
                >
                  ← Back to Home
                </button>
                <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-300">
                  Featured Playlist
                </span>
                <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                  Today's Mix
                </h1>
                <p className="text-sm text-zinc-300 font-medium">
                  100 custom curated tracks. Plays in exact sequence.
                </p>
                <span className="text-xs text-zinc-400 font-semibold mt-1">
                  {displayMixTracks.length} tracks remaining
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                if (displayMixTracks.length > 0) {
                  onPlayTrack(displayMixTracks[0], displayMixTracks);
                }
              }}
              className="w-14 h-14 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black flex items-center justify-center shadow-2xl transition-all hover:scale-105 active:scale-95 shrink-0"
              title="Play All in Order"
            >
              <Play className="w-7 h-7 fill-black translate-x-0.5" />
            </button>
          </div>

          {/* Track table with delete option */}
          <div className="divide-y divide-zinc-800/60 bg-zinc-900/40 rounded-2xl border border-zinc-800 p-2 sm:p-4">
            {displayMixTracks.map((track, idx) => (
              <div
                key={track.instanceId || `${track.id}_${idx}`}
                className="flex items-center justify-between p-3 hover:bg-zinc-800/60 rounded-xl group transition-colors"
              >
                <div
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  onClick={() => onPlayTrack(track, displayMixTracks.slice(idx))}
                >
                  <span className="w-6 text-xs font-mono text-zinc-500 group-hover:text-white">{idx + 1}</span>
                  <img src={track.coverArtUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-white truncate group-hover:text-[#1DB954] transition-colors">{track.title}</span>
                    <span className="text-xs text-zinc-400 truncate">{track.artist}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onRemoveFromTodaysMix(track.instanceId)}
                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all opacity-80 group-hover:opacity-100"
                    title="Remove from Today's Mix"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ----------------- SEARCH TAB ----------------- */}
      {activeTab === 'search' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Search Results {searchQuery && <span className="text-zinc-400 text-lg font-normal">"{searchQuery}"</span>}
            </h2>
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'
                }`}
                title="Grid View"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'table' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'
                }`}
                title="Table List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {filteredTracks.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {filteredTracks.map((track) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    isPlaying={isPlaying}
                    isCurrentTrack={currentTrack?.id === track.id}
                    isLiked={likedTrackIds.includes(track.id)}
                    onPlay={onPlayTrack}
                    onToggleLike={onToggleLike}
                    onAddToPlaylist={onAddToPlaylist}
                onAddToQueue={onAddToQueue}
                  />
                ))}
              </div>
            ) : (
              <TrackTable
                tracks={filteredTracks}
                currentTrackId={currentTrack?.id || null}
                isPlaying={isPlaying}
                likedTrackIds={likedTrackIds}
                onPlayTrack={onPlayTrack}
                onToggleLike={onToggleLike}
                onAddToPlaylist={onAddToPlaylist}
                onAddToQueue={onAddToQueue}
              />
            )
          ) : (
            <div className="py-20 text-center text-zinc-400">
              <Search className="w-12 h-12 mx-auto mb-3 text-zinc-600" />
              <p className="text-lg font-bold text-white">No results found for "{searchQuery}"</p>
              <p className="text-xs text-zinc-500 mt-1">Please check for spelling errors or try searching another term.</p>
            </div>
          )}
        </div>
      )}

      {/* ----------------- YOUR LIBRARY TAB ----------------- */}
      {activeTab === 'library' && !activePlaylistId && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-extrabold text-white">Your Library</h2>
            <button
              onClick={onRequestCreatePlaylist}
              className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black px-4 py-2 rounded-full font-bold text-xs hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Create Playlist</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {/* Create Playlist Prompt Tile */}
            <div
              onClick={onRequestCreatePlaylist}
              className="p-6 rounded-2xl bg-zinc-900/90 border-2 border-dashed border-emerald-500/40 hover:border-[#1DB954] flex flex-col justify-between cursor-pointer group hover:bg-emerald-950/20 hover:scale-[1.02] transition-all shadow-xl min-h-[200px]"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-[#1DB954]/20 flex items-center justify-center text-[#1DB954]">
                  <Plus className="w-7 h-7 stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-extrabold text-[#1DB954] uppercase tracking-wider bg-[#1DB954]/10 px-2.5 py-1 rounded-full">
                  New
                </span>
              </div>

              <div>
                <h3 className="text-2xl font-black text-white group-hover:text-[#1DB954] transition-colors">
                  Create Playlist
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Build custom mix collections of your favorite songs
                </p>
              </div>
            </div>

            {/* Liked Songs Tile */}
            <div
              onClick={() => onPlayTrack(likedTracks[0] || tracks[0])}
              className="p-6 rounded-2xl bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-600 flex flex-col justify-between cursor-pointer group hover:scale-[1.02] transition-transform shadow-xl min-h-[200px]"
            >
              <div className="flex items-start justify-between">
                <Heart className="w-10 h-10 fill-white text-white" />
                <button className="w-12 h-12 rounded-full bg-[#1DB954] text-black flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all shadow-2xl">
                  <Play className="w-6 h-6 fill-black translate-x-0.5" />
                </button>
              </div>

              <div>
                <h3 className="text-2xl font-black text-white">Liked Songs</h3>
                <p className="text-sm font-semibold text-white/80 mt-1">
                  {likedTracks.length} saved tracks
                </p>
              </div>
            </div>

            {/* Today's Mix 100 Songs Tile */}
            <div
              onClick={() => setIsViewingTodaysMix(true)}
              className="p-6 rounded-2xl bg-gradient-to-br from-emerald-800 via-teal-900 to-zinc-900 border border-emerald-500/30 flex flex-col justify-between cursor-pointer group hover:scale-[1.02] transition-transform shadow-xl min-h-[200px]"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/40">
                  <Sparkles className="w-6 h-6" />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (todaysMixTracks.length > 0) {
                      onPlayTrack(todaysMixTracks[0], todaysMixTracks);
                    }
                  }}
                  className="w-12 h-12 rounded-full bg-[#1DB954] text-black flex items-center justify-center opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all shadow-2xl"
                  title="Play Today's Mix"
                >
                  <Play className="w-6 h-6 fill-black translate-x-0.5" />
                </button>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-black text-white">Today's Mix</h3>
                  <span className="text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    Featured
                  </span>
                </div>
                <p className="text-sm font-semibold text-emerald-300/80 mt-1">
                  {todaysMixTracks.length} custom tracks
                </p>
              </div>
            </div>

            {/* Custom Playlists */}
            {playlists.map((pl) => {
              const firstTrackInPl = tracks.find((t) => pl.trackIds.includes(t.id));

              return (
                <div
                  key={pl.id}
                  onClick={() => onSelectPlaylist(pl.id)}
                  className="p-6 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex flex-col justify-between cursor-pointer group hover:bg-zinc-800 hover:scale-[1.02] transition-all shadow-xl min-h-[200px] relative"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-700 flex items-center justify-center">
                      <Music className="w-6 h-6 text-white" />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePlaylist(pl.id);
                        }}
                        className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-700/60 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete Playlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (firstTrackInPl) onPlayTrack(firstTrackInPl);
                        }}
                        className="w-12 h-12 rounded-full bg-[#1DB954] text-black flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all shadow-2xl"
                        title="Play Playlist"
                      >
                        <Play className="w-6 h-6 fill-black translate-x-0.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-white truncate">{pl.name}</h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      {pl.trackIds.length} tracks
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4">
            <h3 className="text-xl font-bold text-white mb-4">All Library Songs</h3>
            <TrackTable
              tracks={tracks}
              currentTrackId={currentTrack?.id || null}
              isPlaying={isPlaying}
              likedTrackIds={likedTrackIds}
              onPlayTrack={onPlayTrack}
              onToggleLike={onToggleLike}
              onAddToPlaylist={onAddToPlaylist}
                onAddToQueue={onAddToQueue}
            />
          </div>
        </div>
      )}

      {/* ----------------- LIKED SONGS VIEW ----------------- */}
      {activeTab === 'liked' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Liked Header Banner */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 bg-gradient-to-b from-indigo-900/80 via-purple-950/40 to-transparent p-6 -mx-4 sm:-mx-6 -mt-4">
            <div className="w-36 h-36 sm:w-48 sm:h-48 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-2xl shrink-0">
              <Heart className="w-16 h-16 sm:w-24 sm:h-24 fill-white text-white" />
            </div>

            <div className="flex flex-col gap-2 text-center sm:text-left">
              <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-300">
                Playlist
              </span>
              <h1 className="text-3xl sm:text-6xl font-black text-white tracking-tight">
                Liked Songs
              </h1>
              <p className="text-sm text-zinc-300 font-medium">
                Your personal collection of saved favorite tracks.
              </p>
              <span className="text-xs text-zinc-400 font-semibold mt-1">
                {likedTracks.length} tracks
              </span>
            </div>
          </div>

          {/* Action Row */}
          {likedTracks.length > 0 && (
            <div className="flex items-center gap-4">
              <button
                onClick={() => onPlayTrack(likedTracks[0])}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#1DB954] hover:bg-[#1ed760] hover:scale-105 active:scale-95 text-black flex items-center justify-center shadow-2xl transition-all"
                title="Play All Liked Songs"
              >
                <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-black translate-x-0.5" />
              </button>
            </div>
          )}

          <TrackTable
            tracks={likedTracks}
            currentTrackId={currentTrack?.id || null}
            isPlaying={isPlaying}
            likedTrackIds={likedTrackIds}
            onPlayTrack={onPlayTrack}
            onToggleLike={onToggleLike}
            onAddToPlaylist={onAddToPlaylist}
                onAddToQueue={onAddToQueue}
          />
        </div>
      )}

      {/* ----------------- CUSTOM PLAYLIST VIEW ----------------- */}
      {activePlaylist && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6 bg-gradient-to-b from-emerald-900/80 via-zinc-950/40 to-transparent p-6 -mx-4 sm:-mx-6 -mt-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
              <div className="w-36 h-36 sm:w-48 sm:h-48 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center shadow-2xl shrink-0">
                <Folder className="w-16 h-16 sm:w-24 sm:h-24 text-white" />
              </div>

              <div className="flex flex-col gap-2 text-center sm:text-left">
                <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-300">
                  Custom Playlist
                </span>
                <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                  {activePlaylist.name}
                </h1>
                {activePlaylist.description && (
                  <p className="text-sm text-zinc-300 font-medium">
                    {activePlaylist.description}
                  </p>
                )}
                <span className="text-xs text-zinc-400 font-semibold mt-1">
                  {playlistTracks.length} tracks
                </span>
              </div>
            </div>

            <button
              onClick={() => onDeletePlaylist(activePlaylist.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800/80 hover:bg-red-900/40 text-zinc-400 hover:text-red-400 border border-zinc-700/60 text-xs font-bold transition-all shrink-0"
              title="Delete Playlist"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Playlist</span>
            </button>
          </div>

          {/* Controls */}
          {playlistTracks.length > 0 && (
            <div className="flex items-center gap-4">
              <button
                onClick={() => onPlayTrack(playlistTracks[0])}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#1DB954] hover:bg-[#1ed760] hover:scale-105 active:scale-95 text-black flex items-center justify-center shadow-2xl transition-all"
                title="Play Playlist"
              >
                <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-black translate-x-0.5" />
              </button>
            </div>
          )}

          {/* Playlist Track Table */}
          {playlistTracks.length > 0 ? (
            <TrackTable
              tracks={playlistTracks}
              currentTrackId={currentTrack?.id || null}
              isPlaying={isPlaying}
              likedTrackIds={likedTrackIds}
              onPlayTrack={onPlayTrack}
              onToggleLike={onToggleLike}
              onRemoveFromPlaylist={(trackId) => onRemoveFromPlaylist(trackId, activePlaylist.id)}
            />
          ) : (
            <div className="py-12 px-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center text-zinc-400">
              <Music className="w-12 h-12 mx-auto mb-3 text-zinc-600" />
              <h3 className="text-lg font-bold text-white mb-1">Your playlist is empty</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-4">
                Add songs to "{activePlaylist.name}" from your library below or while browsing.
              </p>
            </div>
          )}

          {/* Add More Songs to Playlist Section */}
          {availableTracksToAdd.length > 0 && (
            <div className="pt-6 border-t border-zinc-800/80">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#1DB954]" />
                    Add songs to {activePlaylist.name}
                  </h3>
                  <p className="text-xs text-zinc-400">Based on songs in your library</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {availableTracksToAdd.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                      <div className="w-10 h-10 rounded bg-zinc-900 shrink-0 overflow-hidden">
                        <img
                          src={track.coverArtUrl}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-white truncate">{track.title}</span>
                        <span className="text-[11px] text-zinc-400 truncate">{track.artist}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => onAddToPlaylist(track)}
                      className="px-3 py-1.5 rounded-full bg-zinc-700 hover:bg-[#1DB954] hover:text-black text-white text-xs font-bold transition-all shrink-0"
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ----------------- SYNCHRONIZED KARAOKE LYRICS VIEW ----------------- */}
      {activeTab === 'lyrics' && (
        <div className="h-[calc(100vh-180px)] md:h-[calc(100vh-160px)] w-full py-2">
          <LyricsView
            currentTrack={currentTrack}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onSeek={onSeek}
            onPlayPause={onPlayPause}
            rawLrc={currentTrack?.lrc}
          />
        </div>
      )}
      {/* ----------------- ADMIN PANEL TAB ----------------- */}
      {activeTab === 'admin' && (
        <AdminPanel
          tracks={tracks}
          isLoadingHF={isLoadingHF}
          onRefreshLibrary={onRefreshLibrary}
          addToast={addToast}
        />
      )}
    </main>
  );
};

/* ----------------- Auto-Generated Mix Row (Today's Mix / Top Played / Recently Played) ----------------- */
interface MixRowProps {
  title: string;
  icon: React.ReactNode;
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  likedTrackIds: string[];
  onPlayTrack: (track: Track) => void;
  onToggleLike: (trackId: string, e: React.MouseEvent) => void;
  onAddToPlaylist: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
}

const MixRow: React.FC<MixRowProps> = ({
  title,
  icon,
  tracks,
  currentTrack,
  isPlaying,
  likedTrackIds,
  onPlayTrack,
  onToggleLike,
  onAddToPlaylist,
  onAddToQueue,
}) => {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="text-xl sm:text-2xl font-bold text-white">{title}</h2>
      </div>
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 custom-scrollbar snap-x">
        {tracks.map((track) => (
          <div key={track.id} className="w-[140px] sm:w-[170px] shrink-0 snap-start">
            <TrackCard
              track={track}
              isPlaying={isPlaying}
              isCurrentTrack={currentTrack?.id === track.id}
              isLiked={likedTrackIds.includes(track.id)}
              onPlay={onPlayTrack}
              onToggleLike={onToggleLike}
              onAddToPlaylist={onAddToPlaylist}
              onAddToQueue={onAddToQueue}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
