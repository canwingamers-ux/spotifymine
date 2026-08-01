import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Track } from '../types';
import { parseLrc, getActiveLineIndex, generateSampleLrc, LrcLine } from '../utils/lrcParser';
import { Sparkles, Music, Mic2, Play, Pause, AlignCenter } from 'lucide-react';
import { generateCoverArt } from '../utils/audioUtils';

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
  const activeLineRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [fetchedLrc, setFetchedLrc] = useState<string | null>(null);

  useEffect(() => {
    if (!currentTrack) {
      setFetchedLrc(null);
      return;
    }
    const lrcPath = currentTrack.path.replace(/\.[^/.]+$/, '.lrc');
    const url = `https://huggingface.co/datasets/CoolJaat/my-music-library/resolve/main/${encodeURIComponent(lrcPath)}`;
    fetch(url)
      .then(res => res.ok ? res.text() : Promise.reject('Not found'))
      .then(text => setFetchedLrc(text))
      .catch(() => setFetchedLrc(null));
  }, [currentTrack]);

  // Parse LRC into structured array
  const lyrics: LrcLine[] = useMemo(() => {
    if (!currentTrack) return [];
    const sourceLrc =
      rawLrc || fetchedLrc || generateSampleLrc(currentTrack.title, currentTrack.artist, currentTrack.duration);
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
      lineEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, autoScroll]);

  if (!currentTrack) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-20">
        <Music className="w-16 h-16 mb-4 text-zinc-700 animate-pulse" />
        <p className="text-base font-bold text-zinc-400">No song selected</p>
        <p className="text-xs text-zinc-600 mt-1">Play a track to view synced karaoke lyrics</p>
      </div>
    );
  }

  const coverArt =
    currentTrack.coverArtUrl ||
    generateCoverArt(currentTrack.title, currentTrack.artist, currentTrack.gradientColors);

  return (
    <div className="relative flex flex-col h-full w-full rounded-3xl overflow-hidden bg-gradient-to-b from-zinc-950/90 via-[#0a0a0a] to-[#121212] border border-zinc-800/80 shadow-2xl animate-in fade-in duration-300 select-none">
      {/* Background Animated Gradient Glow */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none blur-3xl transition-all duration-700"
        style={{
          background: `radial-gradient(circle at 50% 30%, ${currentTrack.gradientColors[0]}, ${currentTrack.gradientColors[1]}, transparent 70%)`,
        }}
      />

      {/* Top Karaoke Banner Header */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-zinc-800/60 bg-zinc-900/40 backdrop-blur-md">
        <div className="flex items-center gap-3.5 min-w-0">
          <img
            src={coverArt}
            alt={currentTrack.title}
            className="w-11 h-11 rounded-xl object-cover shadow-md shrink-0 border border-zinc-700/50"
          />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <Mic2 className="w-4 h-4 text-[#1DB954] shrink-0" />
              <span className="text-xs font-black uppercase tracking-widest text-[#1DB954]">
                Synced Lyrics
              </span>
            </div>
            <h3 className="text-sm font-bold text-white truncate">{currentTrack.title}</h3>
            <p className="text-[11px] text-zinc-400 truncate">{currentTrack.artist}</p>
          </div>
        </div>

        {/* Header Right Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              autoScroll
                ? 'bg-[#1DB954]/20 border border-[#1DB954]/50 text-[#1DB954]'
                : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white'
            }`}
            title={autoScroll ? 'Auto-scroll Enabled' : 'Click to Enable Auto-scroll'}
          >
            <AlignCenter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{autoScroll ? 'Auto Scroll' : 'Manual Scroll'}</span>
          </button>
        </div>
      </div>

      {/* Lyrics Scrollable Container */}
      <div
        ref={containerRef}
        onWheel={() => setAutoScroll(false)}
        onTouchMove={() => setAutoScroll(false)}
        className="relative z-10 flex-1 overflow-y-auto px-6 py-24 space-y-6 sm:space-y-8 custom-scrollbar text-center sm:text-left transition-all"
      >
        {lyrics.length > 0 ? (
          lyrics.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPassed = idx < activeIndex;

            return (
              <div
                key={line.id}
                data-lyric-index={idx}
                ref={isActive ? activeLineRef : null}
                onClick={() => {
                  onSeek(line.time);
                  setAutoScroll(true);
                }}
                className={`group cursor-pointer transition-all duration-300 py-1 rounded-2xl px-3 -mx-3 hover:bg-white/5 flex items-center justify-between gap-4 ${
                  isActive
                    ? 'scale-105 sm:scale-110 font-black text-2xl sm:text-4xl text-white tracking-tight drop-shadow-[0_0_25px_rgba(29,185,84,0.4)] my-4'
                    : isPassed
                    ? 'text-zinc-500 font-bold text-base sm:text-xl opacity-60 hover:opacity-100 hover:text-zinc-300'
                    : 'text-zinc-600 font-bold text-base sm:text-xl opacity-40 hover:opacity-100 hover:text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Indicator Dot for Active Lyric */}
                  {isActive && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1DB954] shadow-[0_0_12px_#1DB954] animate-ping shrink-0" />
                  )}
                  <p
                    className={`transition-colors duration-200 ${
                      isActive ? 'text-[#1DB954]' : ''
                    }`}
                  >
                    {line.text}
                  </p>
                </div>

                {/* Hover Seek Badge */}
                <span className="opacity-0 group-hover:opacity-100 text-[10px] font-mono font-bold bg-zinc-800 text-zinc-300 px-2 py-1 rounded-md transition-opacity shrink-0">
                  Seek
                </span>
              </div>
            );
          })
        ) : (
          <div className="text-center py-20 text-zinc-500">
            <p className="text-base font-bold text-zinc-400">No synchronized lyrics found</p>
          </div>
        )}
      </div>

      {/* Bottom Sticky Player Indicator Bar */}
      <div className="relative z-10 px-6 py-3 border-t border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onPlayPause && (
            <button
              onClick={onPlayPause}
              className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-black" />
              ) : (
                <Play className="w-4 h-4 fill-black translate-x-0.5" />
              )}
            </button>
          )}
          <span className="text-xs font-mono font-bold text-zinc-400">
            Line {activeIndex + 1} of {lyrics.length}
          </span>
        </div>

        {!autoScroll && (
          <button
            onClick={() => setAutoScroll(true)}
            className="text-xs font-bold text-[#1DB954] hover:underline flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Re-center Sync
          </button>
        )}
      </div>
    </div>
  );
};
