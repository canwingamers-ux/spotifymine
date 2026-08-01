import React, { useState } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Heart,
  Mic2,
  Disc,
  ListMusic,
  Volume2,
  VolumeX,
  Sparkles,
  RefreshCw,
  X,
  Radio
} from 'lucide-react';
import { RepeatMode, Track } from '../types';
import { formatTime, generateCoverArt } from '../utils/audioUtils';
import { LyricsView } from './LyricsView';

interface ExpandedNowPlayingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  bufferedPercent?: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  isLiked: boolean;
  initialTab?: 'art' | 'lyrics';
  onPlayPause: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onToggleLike: (trackId: string, e: React.MouseEvent) => void;
  onOpenQueue: () => void;
  userQueue?: Track[];
  isAutoplay?: boolean;
  onToggleAutoplay?: () => void;
  onRemoveFromQueue?: (index: number) => void;
  onPlayTrack?: (track: Track) => void;
}

export const ExpandedNowPlayingModal: React.FC<ExpandedNowPlayingModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  bufferedPercent = 0,
  volume,
  isMuted,
  isShuffle,
  repeatMode,
  isLiked,
  initialTab = 'art',
  onPlayPause,
  onPrevTrack,
  onNextTrack,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onToggleRepeat,
  onToggleLike,
  onOpenQueue,
  userQueue = [],
  isAutoplay = false,
  onToggleAutoplay,
  onRemoveFromQueue,
  onPlayTrack,
}) => {
  const [activeTab, setActiveTab] = useState<'art' | 'lyrics'>(initialTab);
  const [isHoveringProgress, setIsHoveringProgress] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPercent, setHoverPercent] = useState<number>(0);
  const [showQueueSidebar, setShowQueueSidebar] = useState(false);

  // Sync initial tab when opened
  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen || !currentTrack) return null;

  const fallbackSvg = generateCoverArt(
    currentTrack.title,
    currentTrack.artist,
    currentTrack.gradientColors
  );
  const coverArt = currentTrack.coverArtUrl || fallbackSvg;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const effectiveVolume = isMuted ? 0 : volume;

  const handleMouseMoveProgress = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width > 0 && duration > 0) {
      const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const pct = (offsetX / rect.width) * 100;
      const time = (offsetX / rect.width) * duration;
      setHoverPercent(pct);
      setHoverTime(time);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col justify-between overflow-hidden animate-in slide-in-from-bottom duration-300 select-none">
      {/* Background Ambient Color Gradient Glow */}
      <div
        className="absolute inset-0 opacity-25 pointer-events-none blur-3xl transition-all duration-1000 scale-125"
        style={{
          background: `radial-gradient(circle at 50% 30%, ${currentTrack.gradientColors[0]}, ${currentTrack.gradientColors[1]}, transparent 80%)`,
        }}
      />

      {/* TOP HEADER BAR */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-zinc-800/40 bg-zinc-950/60 backdrop-blur-md">
        <button
          onClick={onClose}
          className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800/60 transition-all active:scale-90"
          title="Minimize Player"
        >
          <ChevronDown className="w-7 h-7" />
        </button>

        {/* View Mode Toggle Switcher */}
        <div className="flex bg-zinc-900/90 border border-zinc-800 p-1 rounded-full shadow-lg">
          <button
            onClick={() => setActiveTab('art')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold transition-all ${
              activeTab === 'art'
                ? 'bg-[#1DB954] text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Disc className="w-3.5 h-3.5" />
            <span>Artwork</span>
          </button>
          <button
            onClick={() => setActiveTab('lyrics')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold transition-all ${
              activeTab === 'lyrics'
                ? 'bg-[#1DB954] text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" />
            <span>Lyrics</span>
          </button>
        </div>

        <button
          onClick={onOpenQueue}
          className="p-2 lg:hidden text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800/60 transition-all active:scale-90"
          title="Playing Queue"
        >
          <ListMusic className="w-6 h-6" />
        </button>
        <button
          onClick={() => setShowQueueSidebar(!showQueueSidebar)}
          className={`p-2 hidden lg:flex rounded-full transition-all active:scale-90 ${
            showQueueSidebar ? 'bg-[#1DB954]/20 text-[#1DB954]' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
          title="Toggle Queue Sidebar"
        >
          <ListMusic className="w-6 h-6" />
        </button>
      </div>

      {/* CENTER CONTENT AREA */}
      <div className="relative z-10 flex-1 overflow-hidden flex items-center justify-center p-4 sm:p-8">
        {activeTab === 'art' ? (
          /* ARTWORK DISPLAY VIEW */
          <div className="flex flex-col items-center justify-center max-w-md w-full my-auto space-y-6 sm:space-y-8 animate-in zoom-in-95 duration-200">
            {/* Album Cover Art */}
            <div className="relative group aspect-square w-full max-w-[340px] sm:max-w-[380px] rounded-3xl overflow-hidden shadow-2xl border border-zinc-800/80">
              <img
                src={coverArt}
                alt={currentTrack.title}
                onError={(e) => {
                  e.currentTarget.src = fallbackSvg;
                }}
                className={`w-full h-full object-cover transition-transform duration-700 ${
                  isPlaying ? 'scale-105' : 'scale-100'
                }`}
              />
              {isPlaying && (
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#1DB954] animate-ping" />
                  <span className="text-[10px] font-black uppercase text-[#1DB954] tracking-wider">
                    Playing
                  </span>
                </div>
              )}
            </div>

            {/* Track Info & Like */}
            <div className="w-full flex items-center justify-between px-2">
              <div className="min-w-0 pr-4">
                <h2 className="text-xl sm:text-2xl font-black text-white truncate tracking-tight">
                  {currentTrack.title}
                </h2>
                <p className="text-sm font-semibold text-zinc-400 truncate mt-1">
                  {currentTrack.artist}
                </p>
              </div>

              <button
                onClick={(e) => onToggleLike(currentTrack.id, e)}
                className={`p-3 rounded-full transition-all active:scale-90 shrink-0 ${
                  isLiked
                    ? 'text-[#1DB954] bg-[#1DB954]/10'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
                title={isLiked ? 'Remove from Liked' : 'Save to Liked'}
              >
                <Heart className={`w-7 h-7 ${isLiked ? 'fill-[#1DB954]' : ''}`} />
              </button>
            </div>
          </div>
        ) : (
          /* KARAOKE LYRICS VIEW */
          <div className="w-full h-full max-w-2xl mx-auto">
            <LyricsView
              currentTrack={currentTrack}
              currentTime={currentTime}
              isPlaying={isPlaying}
              onSeek={onSeek}
              onPlayPause={onPlayPause}
              rawLrc={currentTrack.lrc}
            />
          </div>
        )}
      </div>

      {/* BOTTOM CONTROLS PANEL */}
      <div className="relative z-10 px-6 sm:px-12 pb-8 pt-4 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-900/80 max-w-3xl mx-auto w-full space-y-4">
        {/* Seek Progress Bar */}
        <div className="space-y-1.5">
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              onSeek(pos * duration);
            }}
            onMouseEnter={() => setIsHoveringProgress(true)}
            onMouseLeave={() => {
              setIsHoveringProgress(false);
              setHoverTime(null);
            }}
            onMouseMove={handleMouseMoveProgress}
            className="relative w-full h-2 hover:h-2.5 rounded-full cursor-pointer transition-all group"
          >
            {/* Timestamp Preview Tooltip */}
            {isHoveringProgress && hoverTime !== null && (
              <div
                className="absolute bottom-full mb-2.5 -translate-x-1/2 bg-zinc-900 border border-zinc-700/80 text-white text-[11px] font-mono font-bold px-2.5 py-1 rounded-md shadow-2xl pointer-events-none z-50 whitespace-nowrap flex flex-col items-center animate-in fade-in zoom-in-95 duration-100"
                style={{ left: `${hoverPercent}%` }}
              >
                <span>{formatTime(hoverTime)}</span>
                <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-zinc-900 absolute top-full left-1/2 -translate-x-1/2" />
              </div>
            )}

            {/* Background & Progress Track */}
            <div className="w-full h-full bg-zinc-800 rounded-full overflow-hidden relative">
              {/* Grey chunk-download indicator */}
              <div
                className="absolute inset-y-0 left-0 bg-zinc-500/50 transition-all duration-300 rounded-full"
                style={{ width: `${bufferedPercent}%` }}
              />
              <div
                className="absolute top-0 bottom-0 left-0 bg-[#1DB954] group-hover:bg-[#1ed760] transition-all rounded-full"
                style={{ width: `${progressPercent}%` }}
              />

              {/* Hover Preview Fill */}
              {isHoveringProgress && hoverPercent > progressPercent && (
                <div
                  className="absolute top-0 bottom-0 bg-white/20 pointer-events-none"
                  style={{
                    left: `${progressPercent}%`,
                    width: `${hoverPercent - progressPercent}%`,
                  }}
                />
              )}
            </div>

            {/* Hover Thumb Handle */}
            {isHoveringProgress && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg pointer-events-none -translate-x-1/2"
                style={{ left: `${hoverPercent}%` }}
              />
            )}
          </div>

          <div className="flex justify-between text-[11px] font-mono font-bold text-zinc-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback Controls Bar */}
        <div className="flex items-center justify-between">
          {/* Shuffle Button */}
          <button
            onClick={onToggleShuffle}
            className={`p-2 rounded-full transition-colors ${
              isShuffle ? 'text-[#1DB954]' : 'text-zinc-400 hover:text-white'
            }`}
            title="Shuffle"
          >
            <Shuffle className="w-5 h-5" />
          </button>

          {/* Center Track Jump & Play/Pause */}
          <div className="flex items-center gap-6">
            <button
              onClick={onPrevTrack}
              className="p-2 text-zinc-300 hover:text-white active:scale-90 transition-transform"
              title="Previous Track"
            >
              <SkipBack className="w-7 h-7 fill-current" />
            </button>

            <button
              onClick={onPlayPause}
              className="w-16 h-16 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 fill-black text-black" />
              ) : (
                <Play className="w-8 h-8 fill-black text-black translate-x-0.5" />
              )}
            </button>

            <button
              onClick={onNextTrack}
              className="p-2 text-zinc-300 hover:text-white active:scale-90 transition-transform"
              title="Next Track"
            >
              <SkipForward className="w-7 h-7 fill-current" />
            </button>
          </div>

          {/* Repeat Button */}
          <button
            onClick={onToggleRepeat}
            className={`p-2 rounded-full transition-colors relative ${
              repeatMode !== 'off' ? 'text-[#1DB954]' : 'text-zinc-400 hover:text-white'
            }`}
            title={`Repeat: ${repeatMode}`}
          >
            <Repeat className="w-5 h-5" />
            {repeatMode === 'one' && (
              <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-[#1DB954] text-black rounded-full w-3.5 h-3.5 flex items-center justify-center">
                1
              </span>
            )}
          </button>
        </div>

        {/* Volume Control Slider */}
        <div className="hidden sm:flex items-center gap-3 pt-1 justify-center max-w-xs mx-auto">
          <button
            onClick={onToggleMute}
            className="text-zinc-400 hover:text-white p-1"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={effectiveVolume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#1DB954]"
          />
        </div>
      </div>

      {/* RIGHT SIDE: Queue Sidebar (Desktop only) */}
      {showQueueSidebar && (
        <div className="hidden lg:flex w-96 bg-zinc-900/90 backdrop-blur-3xl border-l border-zinc-800 flex-col h-full animate-in slide-in-from-right-10 z-20 absolute right-0 top-0 bottom-0 shadow-2xl">
          <div className="p-6 border-b border-zinc-800 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Queue</h2>
              <button onClick={() => setShowQueueSidebar(false)} className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-zinc-800/50 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isAutoplay ? 'bg-[#1DB954]/20 text-[#1DB954]' : 'bg-zinc-700 text-zinc-400'}`}>
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Autoplay</h3>
                  <p className="text-[11px] text-zinc-400">Play similar songs when queue ends</p>
                </div>
              </div>
              <button
                onClick={onToggleAutoplay}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isAutoplay ? 'bg-[#1DB954]' : 'bg-zinc-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isAutoplay ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {userQueue.length === 0 ? (
              <div className="text-center text-zinc-500 py-10">
                <p className="text-sm font-bold text-zinc-400">Your queue is empty</p>
                <p className="text-xs mt-1">Add some tracks to keep the music going</p>
              </div>
            ) : (
              userQueue.map((track, idx) => {
                const art = track.coverArtUrl || generateCoverArt(track.title, track.artist, track.gradientColors);
                return (
                  <div key={`${track.id}-${idx}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/60 group transition-colors">
                    <div 
                      className="relative w-12 h-12 shrink-0 rounded-md cursor-pointer overflow-hidden shadow-sm"
                      onClick={() => {
                        onPlayTrack?.(track);
                        onRemoveFromQueue?.(idx);
                      }}
                    >
                      <img src={art} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center">
                        <Play className="w-5 h-5 text-white fill-white translate-x-0.5" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{track.title}</p>
                      <p className="text-xs text-zinc-400 truncate mt-0.5">{track.artist}</p>
                    </div>
                    <button
                      onClick={() => onRemoveFromQueue?.(idx)}
                      className="p-2 text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity shrink-0 rounded-full hover:bg-zinc-700"
                      title="Remove from queue"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
