import React, { useState } from 'react';
import { Play, Pause, Heart, Music, Disc, Plus, ListPlus } from 'lucide-react';
import { Track } from '../types';
import { generateCoverArt } from '../utils/audioUtils';
import { useLongPress } from '../utils/useLongPress';
import { TrackContextMenu } from './TrackContextMenu';

interface TrackCardProps {
  track: Track;
  isPlaying: boolean;
  isCurrentTrack: boolean;
  isLiked: boolean;
  onPlay: (track: Track) => void;
  onToggleLike: (trackId: string, e: React.MouseEvent) => void;
  onAddToPlaylist?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
}

export const TrackCard: React.FC<TrackCardProps> = ({
  track,
  isPlaying,
  isCurrentTrack,
  isLiked,
  onPlay,
  onToggleLike,
  onAddToPlaylist,
  onAddToQueue,
}) => {
  const fallbackSvg = generateCoverArt(track.title, track.artist, track.gradientColors);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const longPress = useLongPress((pos) => setMenuPos(pos));

  return (
    <div
      onClick={() => onPlay(track)}
      {...longPress}
      className="group relative bg-[#181818] hover:bg-[#282828] p-3 sm:p-4 rounded-xl transition-all duration-300 cursor-pointer flex flex-col gap-3 border border-transparent hover:border-zinc-700/40 shadow-md hover:shadow-xl active:scale-95 sm:active:scale-100"
    >
      {/* Cover Art Container */}
      <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-zinc-900 shadow-md">
        <img
          src={track.coverArtUrl || fallbackSvg}
          alt={track.title}
          onError={(e) => {
            e.currentTarget.src = fallbackSvg;
          }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Playing Overlay / Equalizer */}
        {isCurrentTrack && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center">
            {isPlaying ? (
              <div className="flex items-end gap-1 h-6">
                <span className="w-1.5 bg-[#1DB954] rounded-full animate-bounce [animation-delay:-0.3s] h-full" />
                <span className="w-1.5 bg-[#1DB954] rounded-full animate-bounce [animation-delay:-0.15s] h-4" />
                <span className="w-1.5 bg-[#1DB954] rounded-full animate-bounce h-6" />
                <span className="w-1.5 bg-[#1DB954] rounded-full animate-bounce [animation-delay:-0.4s] h-3" />
              </div>
            ) : (
              <Disc className="w-8 h-8 text-[#1DB954]" />
            )}
          </div>
        )}

        {/* Hover / Active Green Play Button Overlay */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay(track);
          }}
          className={`absolute bottom-3 right-3 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black flex items-center justify-center shadow-2xl transition-all duration-300 transform ${
            isCurrentTrack
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-100 sm:opacity-0 translate-y-0 sm:translate-y-3 group-hover:opacity-100 group-hover:translate-y-0 hover:scale-105'
          }`}
          aria-label={isCurrentTrack && isPlaying ? 'Pause' : 'Play'}
        >
          {isCurrentTrack && isPlaying ? (
            <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-black" />
          ) : (
            <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-black translate-x-0.5" />
          )}
        </button>

        {/* Top Badges / Actions: Add to Playlist & Heart Like */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
          {onAddToQueue && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToQueue(track);
              }}
              className="p-1.5 rounded-full bg-black/50 backdrop-blur-md text-white/80 opacity-100 sm:opacity-0 group-hover:opacity-100 hover:text-white hover:bg-black/80 transition-all"
              title="Add to Queue"
            >
              <ListPlus className="w-4 h-4" />
            </button>
          )}
          {onAddToPlaylist && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToPlaylist(track);
              }}
              className="p-1.5 rounded-full bg-black/50 backdrop-blur-md text-white/80 opacity-100 sm:opacity-0 group-hover:opacity-100 hover:text-white hover:bg-black/80 transition-all"
              title="Add to Playlist"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={(e) => onToggleLike(track.id, e)}
            className={`p-1.5 rounded-full backdrop-blur-md transition-all ${
              isLiked
                ? 'bg-black/60 text-[#1DB954] opacity-100'
                : 'bg-black/40 text-white/70 opacity-100 sm:opacity-0 group-hover:opacity-100 hover:text-white hover:bg-black/60'
            }`}
            title={isLiked ? 'Remove from Liked' : 'Save to Liked'}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#1DB954]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Track Details */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <h3 className={`font-bold text-sm truncate ${isCurrentTrack ? 'text-[#1DB954]' : 'text-white'}`}>
          {track.title}
        </h3>
        <p className="text-xs text-zinc-400 truncate font-medium">
          {track.artist || 'SpotifyMine'}
        </p>
      </div>

      {menuPos && (
        <TrackContextMenu
          track={track}
          position={menuPos}
          isLiked={isLiked}
          onClose={() => setMenuPos(null)}
          onPlay={onPlay}
          onAddToQueue={onAddToQueue}
          onAddToPlaylist={onAddToPlaylist}
          onToggleLike={onToggleLike}
        />
      )}
    </div>
  );
};
