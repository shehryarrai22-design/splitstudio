import React, { useRef, useState, useEffect, useCallback } from 'react';
import { formatTimestamp } from '../utils/formatters';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Repeat,
} from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  duration: number;
  fps?: number;
  currentTime: number;
  onTimeChange: (time: number) => void;
  loopRange?: { start: number; end: number } | null;
  onClearLoop?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  duration,
  fps = 30,
  currentTime,
  onTimeChange,
  loopRange,
  onClearLoop,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Sync video time when currentTime prop changes from outside (e.g. timeline click)
  useEffect(() => {
    if (videoRef.current) {
      if (Math.abs(videoRef.current.currentTime - currentTime) > 0.05) {
        videoRef.current.currentTime = currentTime;
      }
    }
  }, [currentTime]);

  // Handle loop range boundary checking
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    onTimeChange(curr);

    if (loopRange) {
      if (curr >= loopRange.end || curr < loopRange.start) {
        videoRef.current.currentTime = loopRange.start;
      }
    }
  }, [loopRange, onTimeChange]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      if (loopRange && (videoRef.current.currentTime >= loopRange.end || videoRef.current.currentTime < loopRange.start)) {
        videoRef.current.currentTime = loopRange.start;
      }
      videoRef.current.play().catch((e) => console.warn('Play interrupted:', e));
    }
  };

  const stepFrame = (frames: number) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
    const frameDuration = 1 / (fps || 30);
    const nextTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + frames * frameDuration));
    videoRef.current.currentTime = nextTime;
    onTimeChange(nextTime);
  };

  const stepSeconds = (secs: number) => {
    if (!videoRef.current) return;
    const nextTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + secs));
    videoRef.current.currentTime = nextTime;
    onTimeChange(nextTime);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      if (val === 0) {
        videoRef.current.muted = true;
        setIsMuted(true);
      } else if (isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  // Keyboard navigation for precision editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (e.shiftKey) stepSeconds(-1);
        else stepFrame(-1);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (e.shiftKey) stepSeconds(1);
        else stepFrame(1);
      } else if (e.code === 'KeyJ') {
        e.preventDefault();
        stepSeconds(-5);
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        stepSeconds(5);
      } else if (e.code === 'KeyK') {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, fps, duration, loopRange]);

  const currentFrame = Math.floor(currentTime * fps);
  const totalFrames = Math.floor(duration * fps);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col bg-zinc-950 rounded-2xl border border-zinc-800/80 overflow-hidden shadow-2xl group"
    >
      {/* Video Viewport */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain cursor-pointer"
          onClick={togglePlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onWaiting={() => setIsLoading(true)}
          onCanPlay={() => setIsLoading(false)}
          preload="auto"
          playsInline
        />

        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
            <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
          </div>
        )}

        {/* Big play overlay if paused */}
        {!isPlaying && !isLoading && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-violet-600/80 hover:bg-violet-600 text-white flex items-center justify-center shadow-2xl backdrop-blur-sm transition-transform transform hover:scale-105 active:scale-95"
          >
            <Play className="w-7 h-7 fill-white ml-1" />
          </button>
        )}

        {/* Loop range indicator badge */}
        {loopRange && (
          <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/90 border border-indigo-500/40 text-indigo-300 text-xs shadow-lg backdrop-blur-md">
            <Repeat className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            <span>Looping Segment: {formatTimestamp(loopRange.start)} - {formatTimestamp(loopRange.end)}</span>
            {onClearLoop && (
              <button
                onClick={onClearLoop}
                className="ml-1 text-zinc-400 hover:text-white text-xs underline"
              >
                Exit Loop
              </button>
            )}
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="p-3 bg-zinc-900/90 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Playback controls & frame-accurate stepping */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-lg bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center transition shadow-md shadow-violet-600/20"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
          </button>

          {/* Jump -5s */}
          <button
            onClick={() => stepSeconds(-5)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            title="Backward 5s (J)"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Frame Step Backward (-1f) */}
          <button
            onClick={() => stepFrame(-1)}
            className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 transition"
            title="Step -1 frame (Arrow Left)"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-violet-400" />
            <span className="font-mono text-[11px]">-1f</span>
          </button>

          {/* Frame Step Forward (+1f) */}
          <button
            onClick={() => stepFrame(1)}
            className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 transition"
            title="Step +1 frame (Arrow Right)"
          >
            <span className="font-mono text-[11px]">+1f</span>
            <ChevronRight className="w-3.5 h-3.5 text-violet-400" />
          </button>

          {/* Jump +5s */}
          <button
            onClick={() => stepSeconds(5)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            title="Forward 5s (L)"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Center: High-Precision Timecode & Frame Counter */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-zinc-300">
          <span className="text-violet-400 font-semibold">{formatTimestamp(currentTime, true)}</span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400">{formatTimestamp(duration, true)}</span>
          <span className="hidden sm:inline text-zinc-600">|</span>
          <span className="hidden sm:inline text-[11px] text-zinc-400">
            F: <span className="text-cyan-400">{currentFrame}</span> / {totalFrames} ({fps} fps)
          </span>
        </div>

        {/* Right: Volume, Speed & Fullscreen */}
        <div className="flex items-center gap-2">
          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-zinc-950 px-2 py-1 rounded-lg border border-zinc-800">
            <span className="text-[10px] text-zinc-500 font-medium">Speed:</span>
            <select
              value={playbackSpeed}
              onChange={(e) => handleSpeedChange(Number(e.target.value))}
              className="bg-transparent text-zinc-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="0.25">0.25x</option>
              <option value="0.5">0.5x</option>
              <option value="1">1.0x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2.0x</option>
            </select>
          </div>

          {/* Volume Control */}
          <div className="hidden sm:flex items-center gap-1.5 bg-zinc-950 px-2 py-1 rounded-lg border border-zinc-800">
            <button
              onClick={toggleMute}
              className="text-zinc-400 hover:text-white transition"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-14 h-1 accent-violet-500 bg-zinc-800 rounded cursor-pointer"
            />
          </div>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
