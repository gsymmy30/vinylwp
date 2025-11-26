
import React from 'react';
import { Icons } from './Icons';
import { PlayerState } from '../types';

interface ControlsProps {
  playerState: PlayerState;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  colors: { secondary: string; text: string };
}

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const Controls: React.FC<ControlsProps> = ({ 
  playerState, 
  onTogglePlay, 
  onNext, 
  onPrev, 
  onSeek,
  colors 
}) => {
  const { isPlaying, currentTime, duration } = playerState;
  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-4 md:gap-6 z-20">
      
      {/* Progress Bar */}
      <div className="w-full flex items-center gap-3 text-xs font-medium" style={{ color: colors.text }}>
        <span className="w-10 text-right opacity-60 tabular-nums">{formatTime(currentTime)}</span>
        <div className="flex-1 relative h-1.5 bg-black/5 rounded-full overflow-hidden cursor-pointer group touch-none"
             onClick={(e) => {
               const rect = e.currentTarget.getBoundingClientRect();
               const x = e.clientX - rect.left;
               const newTime = (x / rect.width) * duration;
               onSeek(newTime);
             }}>
          <div 
            className="absolute top-0 left-0 h-full rounded-full transition-all duration-100 ease-out"
            style={{ width: `${progress}%`, backgroundColor: colors.secondary }}
          />
        </div>
        <span className="w-10 opacity-60 tabular-nums">{formatTime(duration)}</span>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-6 md:gap-8">
        <button 
          onClick={onPrev}
          className="p-3 rounded-full hover:bg-black/5 transition-colors active:scale-95"
          style={{ color: colors.text }}
        >
          <Icons.SkipBack size={20} className="md:w-6 md:h-6" strokeWidth={1.5} />
        </button>

        <button 
          onClick={onTogglePlay}
          className="p-5 md:p-6 rounded-full shadow-lg transition-transform active:scale-95 hover:scale-105 flex items-center justify-center"
          style={{ backgroundColor: colors.secondary, color: '#fff' }}
        >
          {isPlaying ? (
            <Icons.Pause size={28} className="md:w-8 md:h-8" strokeWidth={1.5} fill="currentColor" />
          ) : (
            <Icons.Play size={28} className="md:w-8 md:h-8 ml-1" strokeWidth={1.5} fill="currentColor" />
          )}
        </button>

        <button 
          onClick={onNext}
          className="p-3 rounded-full hover:bg-black/5 transition-colors active:scale-95"
          style={{ color: colors.text }}
        >
          <Icons.SkipForward size={20} className="md:w-6 md:h-6" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
};

export default Controls;
