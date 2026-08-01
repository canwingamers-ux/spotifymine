import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  User,
  X,
  LogOut,
  LogIn,
  Download,
  Shield
} from 'lucide-react';
import { ActiveTab } from '../types';
import { FirebaseUser } from '../lib/firebase';

const ADMIN_EMAIL = 'canwingamers@gmail.com';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab?: (tab: ActiveTab) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  user: FirebaseUser | null;
  onOpenAuthModal: () => void;
  onLogOut: () => void;
  onOpenInstallModal: () => void;
  onOpenAdmin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  user,
  onOpenAuthModal,
  onLogOut,
  onOpenInstallModal,
  onOpenAdmin,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';
  const isAdmin = user?.email === ADMIN_EMAIL;

  return (
    <header
      className="sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center justify-between gap-4"
      style={{
        background: 'rgba(9,9,11,0.85)',
        backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Left: Navigation Controls & Search */}
      <div className="flex items-center gap-3 flex-1 max-w-2xl">
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => window.history.back()}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-all"
            style={{ background: 'rgba(255,255,255,0.08)' }}
            title="Go Back"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.history.forward()}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-all"
            style={{ background: 'rgba(255,255,255,0.08)' }}
            title="Go Forward"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar - hidden on mobile, visible on desktop/tablet */}
        <div className="relative flex-1 max-w-md hidden sm:block">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.trim() && setActiveTab && activeTab !== 'search') {
                setActiveTab('search');
              }
            }}
            onFocus={() => {
              if (setActiveTab && activeTab !== 'search' && searchQuery.trim()) {
                setActiveTab('search');
              }
            }}
            placeholder="What do you want to listen to?"
            className="w-full rounded-full pl-10 pr-9 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
            onFocusCapture={(e) => {
              e.currentTarget.style.border = '1px solid #1DB954';
              e.currentTarget.style.background = 'rgba(255,255,255,0.10)';
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)';
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-0.5 rounded-full transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right: Install + Auth */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenInstallModal}
          title="Get the App"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-zinc-300 hover:text-white transition-all active:scale-95"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Install</span>
        </button>

        {user ? (
          <div className="relative">
            {/* Avatar trigger button */}
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs font-bold text-white transition-all active:scale-95"
              style={{
                background: showDropdown ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.09)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt={displayName} className="w-6 h-6 rounded-full object-cover ring-1 ring-white/20" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#1DB954] to-emerald-300 flex items-center justify-center text-black font-black text-xs shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="hidden sm:inline max-w-[100px] truncate">{displayName}</span>
            </button>

            {/* Dropdown */}
            {showDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                <div
                  className="absolute right-0 top-full mt-2.5 w-56 rounded-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                  style={{
                    background: 'rgba(18,18,18,0.98)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(20px)',
                  }}
                >
                  {/* User info header */}
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center gap-3">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={displayName} className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#1DB954] to-emerald-300 flex items-center justify-center text-black font-black text-sm shrink-0">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{displayName}</p>
                        <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Admin Panel option — only for canwingamers@gmail.com */}
                  {isAdmin && onOpenAdmin && (
                    <button
                      onClick={() => { setShowDropdown(false); onOpenAdmin(); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors group"
                      style={{ color: '#1DB954' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(29,185,84,0.10)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(29,185,84,0.15)' }}
                      >
                        <Shield className="w-3.5 h-3.5" style={{ color: '#1DB954' }} />
                      </div>
                      <span>Admin Panel</span>
                    </button>
                  )}

                  {/* Log Out */}
                  <button
                    onClick={() => { setShowDropdown(false); onLogOut(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-red-400 transition-colors"
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(239,68,68,0.12)' }}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </div>
                    <span>Log Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuthModal}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-extrabold text-black shadow-lg hover:scale-105 active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #1DB954, #1ed760)' }}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Log In</span>
          </button>
        )}
      </div>
    </header>
  );
};
