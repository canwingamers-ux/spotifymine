import React from 'react';
import { X, Play, Music, ListMusic, Radio, Trash2, Shuffle } from 'lucide-react';
import { Track } from '../types';

interface QueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  queue: Track[];
  userQueue?: Track[];
  currentTrack: Track | null;
  onPlayTrack: (track: Track) => void;
  isAutoplay?: boolean;
  onToggleAutoplay?: () => void;
  onRemoveFromQueue?: (index: number) => void;
  isShuffle?: boolean;
}

export const QueueModal: React.FC<QueueModalProps> = ({
  isOpen,
  onClose,
  queue,
  userQueue = [],
  currentTrack,
  onPlayTrack,
  isAutoplay = false,
  onToggleAutoplay,
  onRemoveFromQueue,
  isShuffle = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex justify-end animate-in fade-in duration-200">
      <div className="bg-zinc-950 border-l border-zinc-800 w-full max-w-md h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            <ListMusic className="w-5 h-5 text-[#1DB954]" />
            <span>Play Queue</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          {/* Autoplay Toggle */}
          {onToggleAutoplay && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isAutoplay ? 'bg-[#1DB954]/20 text-[#1DB954]' : 'bg-zinc-800 text-zinc-400'}`}>
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
          )}

          {/* Now Playing Section */}
          {currentTrack && (
            <div>
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 px-2">
                Now Playing
              </h4>
              <div className="flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                <img
                  src={currentTrack.coverArtUrl || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&h=100&fit=crop&q=80'}
                  alt={currentTrack.title}
                  className="w-12 h-12 rounded shadow-md object-cover"
                />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-bold text-[#1DB954] truncate">
                    {currentTrack.title}
                  </span>
                  <span className="text-xs font-medium text-zinc-400 truncate">
                    {currentTrack.artist}
                  </span>
                </div>
                <div className="w-4 h-4 rounded-full bg-[#1DB954] animate-pulse shadow-[0_0_10px_#1DB954]" />
              </div>
            </div>
          )}

          {/* User Queue */}
          {userQueue.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 px-2">
                Next in Queue
              </h4>
              <div className="space-y-1 bg-zinc-900/50 rounded-xl p-2 border border-zinc-800/50">
                {userQueue.map((track, idx) => (
                  <div
                    key={`userqueue-${track.id}-${idx}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800 group transition-colors"
                  >
                    <div 
                      className="relative w-10 h-10 rounded overflow-hidden cursor-pointer shrink-0"
                      onClick={() => {
                        onPlayTrack(track);
                        onRemoveFromQueue?.(idx);
                        onClose();
                      }}
                    >
                      <img
                        src={track.coverArtUrl || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&h=100&fit=crop&q=80'}
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 hidden group-hover:flex items-center justify-center">
                        <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                      </div>
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-semibold text-white truncate">{track.title}</span>
                      <span className="text-xs text-zinc-400 truncate">{track.artist}</span>
                    </div>
                    {onRemoveFromQueue && (
                      <button
                        onClick={() => onRemoveFromQueue(idx)}
                        className="p-2 text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove from Queue"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Up Next (Main Playlist or Shuffled Queue) */}
          {queue.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3 px-2">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  {isShuffle ? 'Up Next (Shuffled Queue)' : 'Up Next From List'}
                </h4>
                {isShuffle && (
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/30">
                    <Shuffle className="w-3 h-3" />
                    Shuffled
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {queue.map((track) => (
                  <div
                    key={track.id}
                    onClick={() => {
                      onPlayTrack(track);
                      onClose();
                    }}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-900 group cursor-pointer transition-colors"
                  >
                    <div className="relative w-10 h-10 rounded overflow-hidden shrink-0">
                      <img
                        src={track.coverArtUrl || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&h=100&fit=crop&q=80'}
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 hidden group-hover:flex items-center justify-center">
                        <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                      </div>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-medium text-zinc-200 group-hover:text-white truncate">
                        {track.title}
                      </span>
                      <span className="text-xs text-zinc-500 group-hover:text-zinc-400 truncate">
                        {track.artist}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {queue.length === 0 && userQueue.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Music className="w-12 h-12 text-zinc-700 mb-4" />
              <p className="text-zinc-400 font-medium">Queue is empty</p>
              <p className="text-zinc-500 text-sm mt-1">Add songs from your playlist or search</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
