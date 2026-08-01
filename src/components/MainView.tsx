import React, { useState } from 'react';
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
  Sparkles
} from 'lucide-react';
import { ActiveTab, Playlist, Track } from '../types';
import { TrackCard } from './TrackCard';
import { TrackTable } from './TrackTable';
import { LyricsView } from './LyricsView';
import { getGreeting } from '../utils/audioUtils';

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
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
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
      {/* ----------------- HOME TAB ----------------- */}
      {activeTab === 'home' && !activePlaylistId && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Hero Greeting Section */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-6">
              {greeting}
            </h1>

            {/* Quick Access Top Grid Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Liked Songs Quick Card */}
              <div
                onClick={() => onPlayTrack(likedTracks[0] || tracks[0])}
                className="group flex items-center gap-4 bg-zinc-800/40 hover:bg-zinc-800/80 rounded-lg p-3 cursor-pointer transition-all border border-zinc-800/60 shadow-md hover:shadow-xl"
              >
                <div className="w-16 h-16 rounded-md bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shrink-0 shadow">
                  <Heart className="w-8 h-8 fill-white text-white" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-bold text-white text-base truncate">Liked Songs</span>
                  <span className="text-xs text-zinc-400">{likedTracks.length} tracks</span>
                </div>
                <button className="w-11 h-11 rounded-full bg-[#1DB954] text-black flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all shadow-lg mr-2 shrink-0">
                  <Play className="w-5 h-5 fill-black translate-x-0.5" />
                </button>
              </div>

              {/* All Tracks Quick Card */}
              <div
                onClick={() => onPlayTrack(tracks[0])}
                className="group flex items-center gap-4 bg-zinc-800/40 hover:bg-zinc-800/80 rounded-lg p-3 cursor-pointer transition-all border border-zinc-800/60 shadow-md hover:shadow-xl"
              >
                <div className="w-16 h-16 rounded-md bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center shrink-0 shadow">
                  <Music className="w-8 h-8 text-white" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-bold text-white text-base truncate">Top Tracks</span>
                  <span className="text-xs text-zinc-400">{tracks.length} tracks</span>
                </div>
                <button className="w-11 h-11 rounded-full bg-[#1DB954] text-black flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all shadow-lg mr-2 shrink-0">
                  <Play className="w-5 h-5 fill-black translate-x-0.5" />
                </button>
              </div>

              {/* Create Playlist Quick Card */}
              <div
                onClick={onRequestCreatePlaylist}
                className="group flex items-center gap-4 bg-emerald-950/20 hover:bg-emerald-900/30 rounded-lg p-3 cursor-pointer transition-all border border-dashed border-emerald-500/40 shadow-md hover:shadow-xl"
              >
                <div className="w-16 h-16 rounded-md bg-[#1DB954]/20 flex items-center justify-center shrink-0 shadow text-[#1DB954]">
                  <Plus className="w-8 h-8 stroke-[2.5]" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-bold text-white text-base truncate">Create Playlist</span>
                  <span className="text-xs text-[#1DB954] font-semibold">Custom Mixes</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Music Tracks Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-white">All Songs</h2>
                  <span className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Hugging Face Library
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Listen to popular music tracks & add them to your playlists
                </p>
              </div>

              {/* View Mode Toggle Controls */}
              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                  title="Grid View"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded transition-colors ${
                    viewMode === 'table'
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                  title="Table List View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Display Mode: Grid vs Table */}
            {isLoadingHF ? (
              <div className="py-12 text-center text-zinc-400">
                <Sparkles className="w-8 h-8 animate-spin mx-auto text-[#1DB954] mb-2" />
                <p className="text-sm font-semibold">Loading music library from Hugging Face...</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {tracks.map((track) => (
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
                tracks={tracks}
                currentTrackId={currentTrack?.id || null}
                isPlaying={isPlaying}
                likedTrackIds={likedTrackIds}
                onPlayTrack={onPlayTrack}
                onToggleLike={onToggleLike}
                onAddToPlaylist={onAddToPlaylist}
                onAddToQueue={onAddToQueue}
              />
            )}
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
    </main>
  );
};
