import React, { useState } from 'react';
import { Play, Clock, Heart, Music, Plus, Trash2, ListPlus } from 'lucide-react';
import { Track } from '../types';
import { formatTime, generateCoverArt } from '../utils/audioUtils';
import { useLongPress } from '../utils/useLongPress';
import { TrackContextMenu } from './TrackContextMenu';

interface TrackTableProps {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  likedTrackIds: string[];
  onPlayTrack: (track: Track) => void;
  onToggleLike: (trackId: string, e: React.MouseEvent) => void;
  onAddToPlaylist?: (track: Track) => void;
  onRemoveFromPlaylist?: (trackId: string) => void;
  onAddToQueue?: (track: Track) => void;
}

export const TrackTable: React.FC<TrackTableProps> = ({
  tracks,
  currentTrackId,
  isPlaying,
  likedTrackIds,
  onPlayTrack,
  onToggleLike,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onAddToQueue,
}) => {
  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-zinc-400">
        <Music className="w-12 h-12 mb-3 text-zinc-600 animate-pulse" />
        <p className="text-base font-semibold text-zinc-300">No tracks found</p>
        <p className="text-xs text-zinc-500 max-w-sm mt-1">
          Try searching for a different song or artist.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto select-none">
      <table className="w-full text-left border-collapse">
        {/* Table Header */}
        <thead>
          <tr className="border-b border-zinc-800/80 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
            <th className="py-3 px-4 w-12 text-center">#</th>
            <th className="py-3 px-4">Title</th>
            <th className="py-3 px-4 hidden md:table-cell">Album</th>
            <th className="py-3 px-4 hidden lg:table-cell">Date Added</th>
            <th className="py-3 px-4 text-center w-16">
              <Clock className="w-4 h-4 inline" />
            </th>
            <th className="py-3 px-4 w-16 text-right"></th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="divide-y divide-zinc-900/50 text-sm">
          {tracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              isCurrent={currentTrackId === track.id}
              isPlaying={isPlaying}
              isLiked={likedTrackIds.includes(track.id)}
              onPlayTrack={onPlayTrack}
              onToggleLike={onToggleLike}
              onAddToPlaylist={onAddToPlaylist}
              onRemoveFromPlaylist={onRemoveFromPlaylist}
              onAddToQueue={onAddToQueue}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface TrackRowProps {
  track: Track;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  isLiked: boolean;
  onPlayTrack: (track: Track) => void;
  onToggleLike: (trackId: string, e: React.MouseEvent) => void;
  onAddToPlaylist?: (track: Track) => void;
  onRemoveFromPlaylist?: (trackId: string) => void;
  onAddToQueue?: (track: Track) => void;
}

const TrackRow: React.FC<TrackRowProps> = ({
  track,
  index,
  isCurrent,
  isPlaying,
  isLiked,
  onPlayTrack,
  onToggleLike,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onAddToQueue,
}) => {
  const fallbackSvg = generateCoverArt(track.title, track.artist, track.gradientColors);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const longPress = useLongPress((pos) => setMenuPos(pos));

  return (
    <>
      <tr
        onClick={() => onPlayTrack(track)}
        {...longPress}
        className={`group hover:bg-zinc-800/60 rounded-lg transition-colors cursor-pointer ${
          isCurrent ? 'bg-zinc-800/40' : ''
        }`}
      >
                {/* Index / Play Button / Equalizer */}
                <td className="py-3 px-4 text-center w-12 font-mono text-xs">
                  {isCurrent ? (
                    isPlaying ? (
                      <div className="flex items-end justify-center gap-0.5 h-4">
                        <span className="w-1 bg-[#1DB954] rounded-full animate-bounce [animation-delay:-0.3s] h-full" />
                        <span className="w-1 bg-[#1DB954] rounded-full animate-bounce [animation-delay:-0.15s] h-3" />
                        <span className="w-1 bg-[#1DB954] rounded-full animate-bounce h-4" />
                      </div>
                    ) : (
                      <span className="text-[#1DB954] font-bold">●</span>
                    )
                  ) : (
                    <>
                      <span className="group-hover:hidden text-zinc-500 font-bold">{index + 1}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayTrack(track);
                        }}
                        className="hidden group-hover:inline-block text-white hover:text-[#1DB954] transition-colors"
                        aria-label="Play Track"
                      >
                        <Play className="w-4 h-4 fill-current inline" />
                      </button>
                    </>
                  )}
                </td>

                {/* Title & Cover Thumbnail */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-zinc-800 overflow-hidden shrink-0 shadow-sm">
                      <img
                        src={track.coverArtUrl || fallbackSvg}
                        alt={track.title}
                        onError={(e) => {
                          e.currentTarget.src = fallbackSvg;
                        }}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span
                        className={`font-bold truncate ${
                          isCurrent ? 'text-[#1DB954]' : 'text-white'
                        }`}
                      >
                        {track.title}
                      </span>
                      <span className="text-xs text-zinc-400 truncate">
                        {track.artist || 'CoolJaat'}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Album */}
                <td className="py-3 px-4 hidden md:table-cell text-zinc-400 text-xs truncate max-w-[180px]">
                  {track.album || 'Single'}
                </td>

                {/* Date Added */}
                <td className="py-3 px-4 hidden lg:table-cell text-zinc-500 text-xs">
                  {track.dateAdded || 'Recently'}
                </td>

                {/* Duration */}
                <td className="py-3 px-4 text-center text-zinc-400 text-xs font-mono">
                  {formatTime(track.duration)}
                </td>

                {/* Heart Toggle & Actions */}
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {onAddToQueue && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToQueue(track);
                        }}
                        className="p-1.5 text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-white rounded-full transition-colors"
                        title="Add to Queue"
                      >
                        <ListPlus className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => onToggleLike(track.id, e)}
                      className={`p-1.5 rounded-full transition-colors ${
                        isLiked
                          ? 'text-[#1DB954]'
                          : 'text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-white'
                      }`}
                      title={isLiked ? 'Remove from Liked' : 'Save to Liked'}
                    >
                      <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#1DB954]' : ''}`} />
                    </button>

                    {onAddToPlaylist && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToPlaylist(track);
                        }}
                        className="p-1.5 text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-white rounded-full transition-colors"
                        title="Add to Playlist"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}

                    {onRemoveFromPlaylist && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFromPlaylist(track.id);
                        }}
                        className="p-1.5 text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-red-400 rounded-full transition-colors"
                        title="Remove from Playlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
      </tr>

      {menuPos && (
        <tr>
          <td colSpan={6} className="p-0 border-none">
            <TrackContextMenu
              track={track}
              position={menuPos}
              isLiked={isLiked}
              onClose={() => setMenuPos(null)}
              onPlay={onPlayTrack}
              onAddToQueue={onAddToQueue}
              onAddToPlaylist={onAddToPlaylist}
              onToggleLike={onToggleLike}
            />
          </td>
        </tr>
      )}
    </>
  );
};
