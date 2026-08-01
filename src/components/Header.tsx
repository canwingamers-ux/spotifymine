import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  User,
  X,
  LogOut,
  LogIn,
  Download
} from 'lucide-react';
import { ActiveTab } from '../types';
import { FirebaseUser } from '../lib/firebase';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab?: (tab: ActiveTab) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  user: FirebaseUser | null;
  onOpenAuthModal: () => void;
  onLogOut: () => void;
  onOpenInstallModal: () => void;
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
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';

  return (
    <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-4 border-b border-zinc-900">
      {/* Left: Navigation Controls & Search */}
      <div className="flex items-center gap-3 flex-1 max-w-2xl">
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => window.history.back()}
            className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-black transition-colors"
            title="Go Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => window.history.forward()}
            className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-black transition-colors"
            title="Go Forward"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Live Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
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
            className="w-full bg-zinc-800/90 border border-zinc-700/60 rounded-full pl-10 pr-9 py-2 text-sm text-white placeholder-zinc-400 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Right: Download App + Auth User Profile / Log In Button */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenInstallModal}
          title="Get the App"
          className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-3 py-1.5 rounded-full text-xs font-bold text-zinc-200 hover:text-white transition-all active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Download</span>
        </button>

        {user ? (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-3 py-1.5 rounded-full text-xs font-bold text-white transition-all shadow-md active:scale-95"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={displayName}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#1DB954] to-emerald-300 flex items-center justify-center text-black font-black text-xs">
                  <User className="w-3.5 h-3.5 text-black" />
                </div>
              )}
              <span className="hidden sm:inline max-w-[120px] truncate">{displayName}</span>
            </button>

            {/* User Dropdown */}
            {showDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-2 border-b border-zinc-800">
                    <p className="text-xs font-bold text-white truncate">{displayName}</p>
                    <p className="text-[11px] text-zinc-400 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      onLogOut();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-red-400 hover:bg-zinc-800/80 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuthModal}
            className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black px-4 py-2 rounded-full text-xs font-extrabold shadow-lg hover:scale-105 active:scale-95 transition-all"
          >
            <LogIn className="w-4 h-4" />
            <span>Log In / Sign Up</span>
          </button>
        )}
      </div>
    </header>
  );
};
