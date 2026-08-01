import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Track } from '../types';
import { parseLrc, getActiveLineIndex, LrcLine } from '../utils/lrcParser';
import { Sparkles, Music, Mic2, Play, Pause, AlignCenter, Loader2 } from 'lucide-react';
import { generateCoverArt } from '../utils/audioUtils';

type FetchState = 'idle' | 'loading' | 'found' | 'not_found';

interface LyricsViewProps {
  currentTrack: Track | null;
  currentTime: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onPlayPause?: () => void;
  rawLrc?: string;
}

export const LyricsView: React.FC<LyricsViewProps> = ({
  currentTrack,
  currentTime,
  isPlaying,
  onSeek,
  onPlayPause,
  rawLrc,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [fetchedLrc, setFetchedLrc] = useState<string | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const fetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!currentTrack) {
      setFetchedLrc(null);
      setFetchState('idle');
      return;
    }

    // Abort any in-flight fetch for a previous track
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }

    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setFetchState('loading');
    setFetchedLrc(null);

    const lrcPath = currentTrack.path.replace(/\.[^/.]+$/, '.lrc');
    const url = `https://huggingface.co/datasets/CoolJaat/my-music-library/resolve/main/${encodeURIComponent(lrcPath)}`;

    fetch(url, { signal: controller.signal })
      .then(res => {
        if (res.ok) return res.text();
        throw new Error('Not found');
      })
      .then(text => {
        setFetchedLrc(text);
        setFetchState('found');
      })
      .catch(err => {
        if (err?.name === 'AbortError') return; // ignore stale requests
        setFetchedLrc(null);
        setFetchState('not_found');
      });

    return () => { controller.abort(); };
  }, [currentTrack]);

  // Parse LRC — never fall back to fake generated lyrics
  const lyrics: LrcLine[] = useMemo(() => {
    if (!currentTrack) return [];
    const sourceLrc = rawLrc || fetchedLrc;
    if (!sourceLrc) return [];
    return parseLrc(sourceLrc);
  }, [currentTrack, rawLrc, fetchedLrc]);

  // Compute active line index
  const activeIndex = useMemo(() => {
    return getActiveLineIndex(lyrics, currentTime);
  }, [lyrics, currentTime]);

  // Smooth auto-scroll active lyric line to center of container
  useEffect(() => {
    if (!autoScroll || activeIndex < 0 || !containerRef.current) return;
    const lineEl = containerRef.current.querySelector(
      `[data-lyric-index="${activeIndex}"]`
    ) as HTMLElement;
    if (lineEl) {
      lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex, autoScroll]);

  if (!currentTrack) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-20 gap-4">
        <div className="relative">
          <Music className="w-16 h-16 text-zinc-700" />
          <div className="absolute inset-0 w-16 h-16 rounded-full bg-zinc-800/30 animate-ping" />
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-zinc-400">No song selected</p>
          <p className="text-xs text-zinc-600 mt-1">Play a track to view synced lyrics</p>
        </div>
      </div>
    );
  }

  const coverArt =
    currentTrack.coverArtUrl ||
    generateCoverArt(currentTrack.title, currentTrack.artist, currentTrack.gradientColors);

  const accentColor = currentTrack.gradientColors[0] || '#1DB954';
  const isLoading = fetchState === 'loading' && !rawLrc;
  const noLyricsAvailable = !rawLrc && fetchState === 'not_found';

  return (
    <div
      className="relative flex flex-col h-full w-full rounded-3xl overflow-hidden shadow-2xl select-none"
      style={{ background: 'linear-gradient(180deg, #0f0f0f 0%, #111111 60%, #0a0a0a 100%)' }}
    >
      {/* Ambient top glow */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 55% at 50% 0%, ${accentColor}55, transparent 70%)`,
        }}
      />
      {/* Ambient bottom glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-48 opacity-10 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 100% at 50% 100%, ${accentColor}44, transparent 70%)`,
        }}
      />

      {/* ── HEADER ── */}
      <div
        className="relative z-10 flex items-center justify-between px-5 py-3.5 shrink-0"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(10,10,10,0.70)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <img
              src={coverArt}
              alt={currentTrack.title}
              className="w-10 h-10 rounded-xl object-cover shadow-lg"
              style={{ border: '1.5px solid rgba(255,255,255,0.12)' }}
            />
            {isPlaying && (
              <span
                className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                style={{ background: accentColor, boxShadow: `0 0 8px ${accentColor}` }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Mic2 className="w-3 h-3 shrink-0" style={{ color: accentColor }} />
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: accentColor }}>
                Lyrics
              </span>
            </div>
            <p className="text-[13px] font-bold text-white truncate leading-tight">{currentTrack.title}</p>
            <p className="text-[11px] text-zinc-500 truncate">{currentTrack.artist}</p>
          </div>
        </div>

        <button
          onClick={() => setAutoScroll(prev => !prev)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all shrink-0"
          style={
            autoScroll
              ? { background: `${accentColor}22`, border: `1px solid ${accentColor}55`, color: accentColor }
              : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#71717a' }
          }
          title={autoScroll ? 'Auto-scroll On' : 'Auto-scroll Off'}
        >
          <AlignCenter className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{autoScroll ? 'Auto Scroll' : 'Manual'}</span>
        </button>
      </div>

      {/* ── LYRICS BODY ── */}
      <div
        ref={containerRef}
        onWheel={() => setAutoScroll(false)}
        onTouchMove={() => setAutoScroll(false)}
        className="relative z-10 flex-1 overflow-y-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
            <p className="text-sm font-semibold text-zinc-500">Loading lyrics…</p>
          </div>
        )}

        {/* No lyrics available */}
        {noLyricsAvailable && (
          <div className="flex flex-col items-center justify-center h-full gap-5 py-20 px-8 text-center">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <Music className="w-9 h-9 text-zinc-600" />
            </div>
            <div>
              <p className="text-base font-bold text-zinc-300 mb-1">No lyrics available</p>
              <p className="text-xs text-zinc-600 leading-relaxed max-w-xs mx-auto">
                Synchronized lyrics aren't available for this track yet
              </p>
            </div>
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#52525b' }}
            >
              <Mic2 className="w-3.5 h-3.5" />
              .lrc file not found in library
            </div>
          </div>
        )}

        {/* Actual lyrics lines */}
        {!isLoading && !noLyricsAvailable && lyrics.length > 0 && (
          <div className="px-7 py-20 space-y-1">
            {lyrics.map((line, idx) => {
              const isActive = idx === activeIndex;
              const isPassed = idx < activeIndex;
              const distanceFromActive = Math.abs(idx - activeIndex);

              const opacity = isActive
                ? 1
                : distanceFromActive <= 1
                ? 0.55
                : distanceFromActive <= 3
                ? 0.35
                : distanceFromActive <= 5
                ? 0.20
                : 0.12;

              return (
                <div
                  key={line.id}
                  data-lyric-index={idx}
                  onClick={() => { onSeek(line.time); setAutoScroll(true); }}
                  className="group cursor-pointer transition-all duration-500 ease-out rounded-2xl px-4 py-2 -mx-4 relative"
                  style={{
                    opacity,
                    transform: isActive ? 'scale(1.04)' : 'scale(1)',
                    transformOrigin: 'left center',
                  }}
                >
                  {/* Active glow bg */}
                  {isActive && (
                    <div
                      className="absolute inset-0 rounded-2xl pointer-events-none"
                      style={{
                        background: `linear-gradient(135deg, ${accentColor}12 0%, transparent 70%)`,
                        border: `1px solid ${accentColor}18`,
                      }}
                    />
                  )}
                  {/* Hover bg for inactive */}
                  <div
                    className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  />

                  <div className="relative flex items-center gap-3">
                    {/* Active animated bar */}
                    {isActive && (
                      <div
                        className="shrink-0 w-1 h-6 rounded-full self-center"
                        style={{
                          background: `linear-gradient(180deg, ${accentColor}, ${accentColor}88)`,
                          boxShadow: `0 0 10px ${accentColor}88`,
                          animation: 'lyricsBarPulse 1.4s ease-in-out infinite',
                        }}
                      />
                    )}

                    <p
                      className="transition-all duration-500 leading-snug"
                      style={{
                        fontSize: isActive ? '26px' : '17px',
                        fontWeight: isActive ? 900 : 700,
                        letterSpacing: isActive ? '-0.02em' : '-0.01em',
                        color: isActive ? '#ffffff' : isPassed ? '#a1a1aa' : '#d4d4d8',
                        textShadow: isActive ? `0 0 30px ${accentColor}66` : 'none',
                      }}
                    >
                      {line.text}
                    </p>

                    <span
                      className="ml-auto opacity-0 group-hover:opacity-100 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shrink-0 transition-opacity duration-200"
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        color: '#71717a',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      seek
                    </span>
                  </div>
                </div>
              );
            })}
            <div className="h-24" />
          </div>
        )}
      </div>

      {/* ── FOOTER BAR ── */}
      <div
        className="relative z-10 px-5 py-3 shrink-0 flex items-center justify-between"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(10,10,10,0.80)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center gap-3">
          {onPlayPause && (
            <button
              onClick={onPlayPause}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg"
              style={{ background: accentColor }}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-black text-black" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-black text-black translate-x-0.5" />
              )}
            </button>
          )}
          <span className="text-[11px] font-mono font-semibold text-zinc-500">
            {lyrics.length > 0
              ? `Line ${Math.max(activeIndex + 1, 1)} / ${lyrics.length}`
              : isLoading
              ? 'Loading…'
              : 'No lyrics'}
          </span>
        </div>

        {!autoScroll && lyrics.length > 0 && (
          <button
            onClick={() => setAutoScroll(true)}
            className="flex items-center gap-1.5 text-[11px] font-bold transition-all hover:opacity-80 px-3 py-1.5 rounded-full"
            style={{
              color: accentColor,
              background: `${accentColor}15`,
              border: `1px solid ${accentColor}30`,
            }}
          >
            <Sparkles className="w-3 h-3" />
            Re-sync
          </button>
        )}
      </div>

      <style>{`
        @keyframes lyricsBarPulse {
          0%, 100% { opacity: 1; transform: scaleY(1); }
          50% { opacity: 0.5; transform: scaleY(0.65); }
        }
      `}</style>
    </div>
  );
};
