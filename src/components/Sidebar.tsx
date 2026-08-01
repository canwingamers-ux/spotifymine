import React, { useState } from 'react';
import {
  Home,
  Search,
  Library,
  Heart,
  Plus,
  Music,
  Disc,
  Folder,
  X,
  Mic2
} from 'lucide-react';
import { ActiveTab, Playlist } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  likedCount: number;
  playlists: Playlist[];
  onRequestCreatePlaylist: () => void;
  activePlaylistId: string | null;
  setActivePlaylistId: (id: string | null) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  likedCount,
  playlists,
  onRequestCreatePlaylist,
  activePlaylistId,
  setActivePlaylistId,
}) => {

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-black p-3 gap-2 shrink-0 select-none text-zinc-300">
        {/* Top Navigation Block */}
        <div className="bg-zinc-900/90 rounded-xl p-4 flex flex-col gap-5">
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5 px-1 text-white font-bold text-xl tracking-tight">
            <div className="w-8 h-8 rounded-full bg-[#1DB954] flex items-center justify-center text-black font-black">
              <Disc className="w-5 h-5 text-black animate-spin-slow" />
            </div>
            <span className="text-white font-extrabold">Spotify</span>
          </div>

          {/* Nav Items */}
          <nav className="flex flex-col gap-1">
            <button
              onClick={() => {
                setActiveTab('home');
                setActivePlaylistId(null);
              }}
              className={`flex items-center gap-4 px-3 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 ${
                activeTab === 'home' && !activePlaylistId
                  ? 'text-white bg-zinc-800/80'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
              }`}
            >
              <Home className={`w-5 h-5 ${activeTab === 'home' && !activePlaylistId ? 'text-[#1DB954]' : ''}`} />
              <span>Home</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('search');
                setActivePlaylistId(null);
              }}
              className={`flex items-center gap-4 px-3 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 ${
                activeTab === 'search'
                  ? 'text-white bg-zinc-800/80'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
              }`}
            >
              <Search className={`w-5 h-5 ${activeTab === 'search' ? 'text-[#1DB954]' : ''}`} />
              <span>Search</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('library');
                setActivePlaylistId(null);
              }}
              className={`flex items-center gap-4 px-3 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 ${
                activeTab === 'library' && !activePlaylistId
                  ? 'text-white bg-zinc-800/80'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
              }`}
            >
              <Library className={`w-5 h-5 ${activeTab === 'library' ? 'text-[#1DB954]' : ''}`} />
              <span>Your Library</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('lyrics');
                setActivePlaylistId(null);
              }}
              className={`flex items-center gap-4 px-3 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 ${
                activeTab === 'lyrics'
                  ? 'text-white bg-zinc-800/80'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
              }`}
            >
              <Mic2 className={`w-5 h-5 ${activeTab === 'lyrics' ? 'text-[#1DB954]' : ''}`} />
              <span>Lyrics</span>
            </button>
          </nav>
        </div>

        {/* Library Section Block */}
        <div className="bg-zinc-900/90 rounded-xl p-3 flex-1 flex flex-col gap-3 overflow-hidden">
          {/* Library Header */}
          <div className="flex items-center justify-between px-2 pt-1 pb-2 border-b border-zinc-800/60">
            <div className="flex items-center gap-2 text-zinc-400 font-bold text-sm">
              <Folder className="w-5 h-5 text-zinc-400" />
              <span>Playlists</span>
            </div>

            <button
              onClick={onRequestCreatePlaylist}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
              title="Create Playlist"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Playlists List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {/* Liked Songs Playlist Item */}
            <button
              onClick={() => {
                setActiveTab('liked');
                setActivePlaylistId(null);
              }}
              className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all text-left ${
                activeTab === 'liked'
                  ? 'bg-zinc-800 text-white'
                  : 'hover:bg-zinc-800/50 text-zinc-300'
              }`}
            >
              <div className="w-10 h-10 rounded-md bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shrink-0 shadow">
                <Heart className="w-5 h-5 fill-white text-white" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-white truncate">Liked Songs</span>
                <span className="text-xs text-zinc-400">{likedCount} songs</span>
              </div>
            </button>

            {/* Custom User Playlists */}
            {playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => {
                  setActivePlaylistId(pl.id);
                  setActiveTab('playlist');
                }}
                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all text-left ${
                  activePlaylistId === pl.id
                    ? 'bg-zinc-800 text-white'
                    : 'hover:bg-zinc-800/50 text-zinc-300'
                }`}
              >
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center shrink-0">
                  <Music className="w-5 h-5 text-zinc-400" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-white truncate">{pl.name}</span>
                  <span className="text-xs text-zinc-400">{pl.trackIds.length} tracks</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (< md) - Mobile Optimized */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-zinc-800 flex items-center justify-around py-2.5 px-3 z-40 pb-safe">
        <button
          onClick={() => {
            setActiveTab('home');
            setActivePlaylistId(null);
          }}
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold min-w-[56px] min-h-[44px] justify-center ${
            activeTab === 'home' ? 'text-[#1DB954]' : 'text-zinc-400'
          }`}
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('search');
            setActivePlaylistId(null);
          }}
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold min-w-[56px] min-h-[44px] justify-center ${
            activeTab === 'search' ? 'text-[#1DB954]' : 'text-zinc-400'
          }`}
        >
          <Search className="w-5 h-5" />
          <span>Search</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('library');
            setActivePlaylistId(null);
          }}
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold min-w-[56px] min-h-[44px] justify-center ${
            activeTab === 'library' ? 'text-[#1DB954]' : 'text-zinc-400'
          }`}
        >
          <Library className="w-5 h-5" />
          <span>Library</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('liked');
            setActivePlaylistId(null);
          }}
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold min-w-[56px] min-h-[44px] justify-center ${
            activeTab === 'liked' ? 'text-[#1DB954]' : 'text-zinc-400'
          }`}
        >
          <Heart className="w-5 h-5" />
          <span>Liked</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('lyrics');
            setActivePlaylistId(null);
          }}
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold min-w-[56px] min-h-[44px] justify-center ${
            activeTab === 'lyrics' ? 'text-[#1DB954]' : 'text-zinc-400'
          }`}
        >
          <Mic2 className="w-5 h-5" />
          <span>Lyrics</span>
        </button>
      </nav>
    </>
  );
};
