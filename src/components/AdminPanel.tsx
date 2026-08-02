import React, { useMemo, useState } from 'react';
import { Shield, Key, Search, Trash2, Loader2, RefreshCcw, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Track } from '../types';
import { Storage } from '../utils/storage';
import { HF_CONFIG } from '../utils/audioUtils';

interface AdminPanelProps {
  tracks: Track[];
  isLoadingHF: boolean;
  onRefreshLibrary: () => void;
  addToast: (message: string, type?: 'info' | 'error' | 'success') => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  tracks,
  isLoadingHF,
  onRefreshLibrary,
  addToast,
}) => {
  const [apiKey, setApiKeyState] = useState(() => Storage.getHfAdminKey());
  const [showKey, setShowKey] = useState(false);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const saveKey = () => {
    Storage.setHfAdminKey(apiKey.trim());
    addToast(apiKey.trim() ? 'API key saved to this browser' : 'API key cleared', 'success');
  };

  const filteredTracks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q)
    );
  }, [tracks, search]);

  const handleDelete = async (track: Track) => {
    const key = Storage.getHfAdminKey();
    if (!key) {
      addToast('Enter and save your Hugging Face API key first', 'error');
      return;
    }

    setDeletingId(track.id);
    try {
      const res = await fetch('/api/admin-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: HF_CONFIG.HF_USER,
          repo: HF_CONFIG.HF_REPO,
          path: track.path,
          apiKey: key,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || `Delete failed (${res.status})`);
      }

      addToast(`Deleted "${track.title}" from the library`, 'success');
      onRefreshLibrary();
    } catch (err: any) {
      console.error('Admin delete failed:', err);
      addToast(err?.message || 'Failed to delete track', 'error');
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300 max-w-4xl">
      {/* ── HEADER ── */}
      <div
        className="rounded-2xl p-5 flex items-center gap-4"
        style={{
          background: 'linear-gradient(135deg, rgba(29,185,84,0.12) 0%, rgba(29,185,84,0.04) 100%)',
          border: '1px solid rgba(29,185,84,0.20)',
        }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(29,185,84,0.20)', boxShadow: '0 0 20px rgba(29,185,84,0.15)' }}
        >
          <Shield className="w-6 h-6" style={{ color: '#1DB954' }} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Admin Panel</h1>
          <p className="text-xs mt-0.5" style={{ color: '#52525b' }}>
            Managing <span style={{ color: '#1DB954' }}>{HF_CONFIG.HF_USER}/{HF_CONFIG.HF_REPO}</span> dataset
          </p>
        </div>
      </div>

      {/* ── API KEY CARD ── */}
      <div
        className="rounded-2xl p-5 space-y-3"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center gap-2.5 mb-1">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(29,185,84,0.12)' }}
          >
            <Key className="w-4 h-4" style={{ color: '#1DB954' }} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Hugging Face API Key</p>
            <p className="text-[11px]" style={{ color: '#52525b' }}>Needs write access. Stored only in this browser.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKeyState(e.target.value)}
              placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-all font-mono"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
              }}
              onFocusCapture={e => { e.currentTarget.style.border = '1px solid rgba(29,185,84,0.5)'; }}
              onBlurCapture={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)'; }}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: '#52525b' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
              onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}
              title={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={saveKey}
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-black transition-all active:scale-95 shrink-0 hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #1DB954, #1ed760)' }}
          >
            Save Key
          </button>
        </div>
      </div>

      {/* ── SONGS LIST CARD ── */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-sm font-bold text-white">Library Songs</h2>
            <p className="text-[11px] mt-0.5" style={{ color: '#52525b' }}>{filteredTracks.length} tracks in dataset</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#52525b' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search songs..."
                className="w-full rounded-xl pl-8.5 pr-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  paddingLeft: '2rem',
                }}
                onFocusCapture={e => { e.currentTarget.style.border = '1px solid rgba(29,185,84,0.4)'; }}
                onBlurCapture={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.09)'; }}
              />
            </div>
            {/* Refresh */}
            <button
              onClick={onRefreshLibrary}
              disabled={isLoadingHF}
              className="p-2 rounded-xl transition-all active:scale-95"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: '#a1a1aa' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              title="Refresh library"
            >
              <RefreshCcw className={`w-4 h-4 ${isLoadingHF ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Song rows */}
        {isLoadingHF ? (
          <div className="py-16 text-center">
            <Loader2 className="w-7 h-7 animate-spin mx-auto mb-3" style={{ color: '#1DB954' }} />
            <p className="text-sm" style={{ color: '#71717a' }}>Loading library…</p>
          </div>
        ) : filteredTracks.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: '#52525b' }}>No songs found.</div>
        ) : (
          <div
            className="divide-y max-h-[55vh] overflow-y-auto"
            style={{ divideColor: 'rgba(255,255,255,0.05)', scrollbarWidth: 'none' }}
          >
            {filteredTracks.map((track, idx) => (
              <div
                key={track.id}
                className="flex items-center gap-3 py-2.5 group transition-all"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              >
                {/* Index */}
                <span
                  className="w-6 text-center text-xs font-mono shrink-0 group-hover:hidden"
                  style={{ color: '#52525b' }}
                >
                  {idx + 1}
                </span>
                <button
                  className="w-6 text-center shrink-0 hidden group-hover:flex items-center justify-center"
                  onClick={() => {}}
                  style={{ color: '#1DB954' }}
                >
                  ▶
                </button>

                {/* Cover Art */}
                <img
                  src={track.coverArtUrl}
                  alt={track.title}
                  className="w-9 h-9 rounded-lg object-cover shrink-0"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                  onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                />

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{track.title}</p>
                  <p className="text-xs truncate" style={{ color: '#71717a' }}>{track.artist || 'CoolJaat'}</p>
                </div>

                {/* Path (hidden on small) */}
                <p
                  className="text-[10px] font-mono truncate max-w-[140px] hidden lg:block shrink-0"
                  style={{ color: '#3f3f46' }}
                >
                  {track.path}
                </p>

                {/* Delete action */}
                {confirmId === track.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-semibold hidden sm:inline" style={{ color: '#f59e0b' }}>Delete?</span>
                    <button
                      onClick={() => handleDelete(track)}
                      disabled={deletingId === track.id}
                      className="px-3 py-1.5 rounded-full text-white text-xs font-bold transition-all active:scale-95"
                      style={{ background: '#dc2626', opacity: deletingId === track.id ? 0.6 : 1 }}
                    >
                      {deletingId === track.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="px-3 py-1.5 rounded-full text-white text-xs font-bold transition-all active:scale-95"
                      style={{ background: 'rgba(255,255,255,0.10)' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(track.id)}
                    className="p-2 rounded-xl transition-all shrink-0 opacity-0 group-hover:opacity-100"
                    style={{ color: '#52525b' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.10)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#52525b'; e.currentTarget.style.background = 'transparent'; }}
                    title="Delete from library"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── DANGER WARNING ── */}
      <div
        className="flex items-start gap-3 rounded-2xl p-4 text-xs"
        style={{
          background: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.15)',
          color: '#a16207',
        }}
      >
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
        <p style={{ color: '#a16207' }}>Deleting a song permanently removes its audio file from the Hugging Face dataset. This action <strong style={{ color: '#f59e0b' }}>cannot be undone</strong>.</p>
      </div>
    </div>
  );
};
