import React from 'react';
import {
  Home,
  Search,
  Library,
  Heart,
  Plus,
  Music,
  Disc,
  Folder,
  Mic2,
  Sparkles,
  ListMusic,
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
  onOpenTodaysMix?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  likedCount,
  playlists,
  onRequestCreatePlaylist,
  activePlaylistId,
  setActivePlaylistId,
  onOpenTodaysMix,
}) => {

  const navItem = (
    key: ActiveTab,
    label: string,
    Icon: React.ElementType,
    onClick?: () => void
  ) => {
    const isActive = activeTab === key && !activePlaylistId;
    return (
      <button
        onClick={onClick || (() => { setActiveTab(key); setActivePlaylistId(null); })}
        className="relative flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 w-full text-left"
        style={{
          background: isActive ? 'rgba(29,185,84,0.12)' : 'transparent',
          color: isActive ? '#ffffff' : '#71717a',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#d4d4d8'; e.currentTarget.style.background = isActive ? 'rgba(29,185,84,0.12)' : 'rgba(255,255,255,0.05)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = isActive ? '#ffffff' : '#71717a'; e.currentTarget.style.background = isActive ? 'rgba(29,185,84,0.12)' : 'transparent'; }}
      >
        {isActive && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
            style={{ background: '#1DB954', boxShadow: '0 0 8px #1DB954' }}
          />
        )}
        <Icon
          className="w-5 h-5 shrink-0"
          style={{ color: isActive ? '#1DB954' : 'currentColor' }}
        />
        <span>{label}</span>
      </button>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex flex-col w-60 p-2.5 gap-2 shrink-0 select-none"
        style={{ background: '#000000' }}
      >
        {/* Top Nav Block */}
        <div
          className="rounded-xl p-3 flex flex-col gap-1"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          {/* Brand */}
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: '#1DB954' }}
            >
              <Disc className="w-4 h-4 text-black" style={{ animation: 'spin 4s linear infinite' }} />
            </div>
            <span className="text-white font-extrabold text-base tracking-tight">SpotifyMine</span>
          </div>

          <nav className="flex flex-col gap-0.5">
            {navItem('home', 'Home', Home)}
            {navItem('search', 'Search', Search)}
            {navItem('library', 'Your Library', Library)}
            {navItem('allSongs', 'All Songs', ListMusic)}
            {navItem('lyrics', 'Lyrics', Mic2)}
          </nav>
        </div>

        {/* Library Block */}
        <div
          className="rounded-xl p-3 flex-1 flex flex-col gap-2 overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          {/* Library Header */}
          <div
            className="flex items-center justify-between px-2 pb-2"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-2 text-xs font-bold" style={{ color: '#71717a' }}>
              <Folder className="w-4 h-4" />
              <span>Playlists</span>
            </div>
            <button
              onClick={onRequestCreatePlaylist}
              className="p-1.5 rounded-full transition-all hover:scale-110 active:scale-95"
              style={{ color: '#71717a' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(29,185,84,0.15)'; e.currentTarget.style.color = '#1DB954'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#71717a'; }}
              title="Create Playlist"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Playlists List */}
          <div className="flex-1 overflow-y-auto space-y-0.5 pr-0.5" style={{ scrollbarWidth: 'none' }}>
            {/* Today's Mix */}
            <button
              onClick={() => {
                setActiveTab('home');
                setActivePlaylistId(null);
                if (onOpenTodaysMix) onOpenTodaysMix();
              }}
              className="w-full flex items-center gap-3 p-2 rounded-xl transition-all text-left"
              style={{
                background: 'transparent',
                color: '#a1a1aa',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(29,185,84,0.12)'; e.currentTarget.style.color = '#ffffff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#a1a1aa'; }}
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 via-teal-600 to-green-700 flex items-center justify-center shrink-0 shadow">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold truncate text-white">Today's Mix</span>
                <span className="text-[10px] text-emerald-400 font-semibold">100 songs</span>
              </div>
            </button>

            {/* Liked Songs */}
            <button
              onClick={() => { setActiveTab('liked'); setActivePlaylistId(null); }}
              className="w-full flex items-center gap-3 p-2 rounded-xl transition-all text-left"
              style={{
                background: activeTab === 'liked' ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: activeTab === 'liked' ? '#ffffff' : '#a1a1aa',
              }}
              onMouseEnter={e => { if (activeTab !== 'liked') { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#ffffff'; }}}
              onMouseLeave={e => { e.currentTarget.style.background = activeTab === 'liked' ? 'rgba(255,255,255,0.08)' : 'transparent'; e.currentTarget.style.color = activeTab === 'liked' ? '#ffffff' : '#a1a1aa'; }}
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shrink-0 shadow">
                <Heart className="w-4 h-4 fill-white text-white" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold truncate">Liked Songs</span>
                <span className="text-[10px]" style={{ color: '#71717a' }}>{likedCount} songs</span>
              </div>
            </button>

            {/* Custom Playlists */}
            {playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => { setActivePlaylistId(pl.id); setActiveTab('playlist'); }}
                className="w-full flex items-center gap-3 p-2 rounded-xl transition-all text-left"
                style={{
                  background: activePlaylistId === pl.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: activePlaylistId === pl.id ? '#ffffff' : '#a1a1aa',
                }}
                onMouseEnter={e => { if (activePlaylistId !== pl.id) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#ffffff'; }}}
                onMouseLeave={e => { e.currentTarget.style.background = activePlaylistId === pl.id ? 'rgba(255,255,255,0.08)' : 'transparent'; e.currentTarget.style.color = activePlaylistId === pl.id ? '#ffffff' : '#a1a1aa'; }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <Music className="w-4 h-4" style={{ color: '#71717a' }} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-white truncate">{pl.name}</span>
                  <span className="text-[10px]" style={{ color: '#71717a' }}>{pl.trackIds.length} tracks</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around py-2.5 px-3 z-40"
        style={{
          background: 'rgba(0,0,0,0.96)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {([
          { key: 'home' as ActiveTab, label: 'Home', Icon: Home },
          { key: 'search' as ActiveTab, label: 'Search', Icon: Search },
          { key: 'allSongs' as ActiveTab, label: 'All Songs', Icon: ListMusic },
          { key: 'library' as ActiveTab, label: 'Library', Icon: Library },
          { key: 'liked' as ActiveTab, label: 'Liked', Icon: Heart },
        ]).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setActivePlaylistId(null); }}
            className="flex flex-col items-center gap-1 text-[10px] font-semibold min-w-[48px] min-h-[44px] justify-center transition-colors"
            style={{ color: activeTab === key ? '#1DB954' : '#52525b' }}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
};
