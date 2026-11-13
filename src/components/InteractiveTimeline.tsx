import React, { useRef, useState, useCallback, useEffect } from 'react';
import { formatTimestamp } from '../utils/formatters';
import {
  Scissors,
  Split,
  Trash2,
  Plus,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Info,
} from 'lucide-react';

interface InteractiveTimelineProps {
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  markers: number[];
  onAddMarker: (time?: number) => void;
  onRemoveMarker: (index: number) => void;
  onUpdateMarker: (index: number, newTime: number) => void;
  onClearMarkers: () => void;
  onSplitEqualParts: (parts: number) => void;
  onSplitInterval: (intervalSeconds: number) => void;
  strips?: string[];
}

export const InteractiveTimeline: React.FC<InteractiveTimelineProps> = ({
  duration,
  currentTime,
  onSeek,
  markers,
  onAddMarker,
  onRemoveMarker,
  onUpdateMarker,
  onClearMarkers,
  onSplitEqualParts,
  onSplitInterval,
  strips = [],
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [draggingMarkerIndex, setDraggingMarkerIndex] = useState<number | null>(null);
  const [isScrubbingPlayhead, setIsScrubbingPlayhead] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1x, 2x, 3x

  // Calculate mouse position relative to track
  const getTimeFromPointer = useCallback(
    (clientX: number): number => {
      if (!trackRef.current || duration <= 0) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const relativeX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const percentage = relativeX / rect.width;
      return percentage * duration;
    },
    [duration]
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = getTimeFromPointer(e.clientX);
    setHoverX(x);
    setHoverTime(time);

    if (isScrubbingPlayhead) {
      onSeek(time);
    }
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
    setHoverX(null);
  };

  const handleTrackMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // If clicking directly on track background, seek playhead
    if ((e.target as HTMLElement).closest('.marker-handle')) return;
    const time = getTimeFromPointer(e.clientX);
    onSeek(time);
    setIsScrubbingPlayhead(true);
  };

  // Dragging marker handling
  const handleMarkerMouseDown = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setDraggingMarkerIndex(index);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (draggingMarkerIndex !== null) {
        const newTime = getTimeFromPointer(e.clientX);
        // Clamp time so it stays in video boundary
        const clamped = Math.max(0.05, Math.min(duration - 0.05, newTime));
        onUpdateMarker(draggingMarkerIndex, clamped);
      } else if (isScrubbingPlayhead) {
        const time = getTimeFromPointer(e.clientX);
        onSeek(time);
      }
    };

    const handleGlobalMouseUp = () => {
      if (draggingMarkerIndex !== null) setDraggingMarkerIndex(null);
      if (isScrubbingPlayhead) setIsScrubbingPlayhead(false);
    };

    if (draggingMarkerIndex !== null || isScrubbingPlayhead) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggingMarkerIndex, isScrubbingPlayhead, duration, getTimeFromPointer, onUpdateMarker, onSeek]);

  // Keyboard shortcut M to add split
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.code === 'KeyM') {
        e.preventDefault();
        onAddMarker(currentTime);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, onAddMarker]);

  // Compute segments
  const sortedMarkers = [...markers].sort((a, b) => a - b);
  const boundaries = [0, ...sortedMarkers, duration];
  const segments: Array<{ index: number; start: number; end: number; duration: number }> = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    segments.push({
      index: i,
      start,
      end,
      duration: end - start,
    });
  }

  // Playhead position percentage
  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-zinc-950/90 rounded-2xl border border-zinc-800/80 p-4 shadow-xl space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Marker tools */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Add Split At Current Time */}
          <button
            onClick={() => onAddMarker(currentTime)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium shadow-md shadow-violet-600/25 transition active:scale-95"
            title="Add Split Marker at Playhead (Hotkey: M)"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Split at Playhead (M)</span>
          </button>

          {/* Equal parts dropdown */}
          <div className="relative flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-zinc-300">
            <Split className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] text-zinc-400">Equal Parts:</span>
            <select
              defaultValue=""
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val > 1) {
                  onSplitEqualParts(val);
                  e.target.value = '';
                }
              }}
              className="bg-transparent text-white text-xs focus:outline-none cursor-pointer pr-1"
            >
              <option value="" disabled>
                Select parts...
              </option>
              <option value="2">2 equal clips</option>
              <option value="3">3 equal clips</option>
              <option value="4">4 equal clips</option>
              <option value="5">5 equal clips</option>
              <option value="6">6 equal clips</option>
              <option value="8">8 equal clips</option>
              <option value="10">10 equal clips</option>
            </select>
          </div>

          {/* Social Clips / Duration interval */}
          <div className="relative flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-zinc-300">
            <span className="text-[11px] text-zinc-400">Interval:</span>
            <select
              defaultValue=""
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val > 0) {
                  onSplitInterval(val);
                  e.target.value = '';
                }
              }}
              className="bg-transparent text-white text-xs focus:outline-none cursor-pointer"
            >
              <option value="" disabled>
                Cut every...
              </option>
              <option value="15">Every 15s (Shorts/Reels)</option>
              <option value="30">Every 30s (TikTok/Stories)</option>
              <option value="60">Every 60s (1 Minute clips)</option>
              <option value="120">Every 2 Minutes</option>
            </select>
          </div>

          {/* Clear all markers */}
          {markers.length > 0 && (
            <button
              onClick={onClearMarkers}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-900/50 transition"
              title="Clear all split markers"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear ({markers.length})</span>
            </button>
          )}
        </div>

        {/* Right: Summary badges & Zoom */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800">
            <span className="text-zinc-500">Clips:</span>
            <span className="text-cyan-400 font-mono font-semibold">{segments.length}</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-500">Splits:</span>
            <span className="text-violet-400 font-mono font-semibold">{markers.length}</span>
          </div>

          {/* Zoom toggle */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
            <button
              onClick={() => setZoomLevel(Math.max(1, zoomLevel - 1))}
              disabled={zoomLevel <= 1}
              className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[10px] font-mono text-zinc-400">{zoomLevel}x</span>
            <button
              onClick={() => setZoomLevel(Math.min(3, zoomLevel + 1))}
              disabled={zoomLevel >= 3}
              className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Timeline Viewport / Scroll Area */}
      <div className="overflow-x-auto pb-2 scrollbar-thin">
        <div
          style={{ width: `${zoomLevel * 100}%`, minWidth: '100%' }}
          className="relative transition-all duration-150 select-none"
        >
          {/* Segment Bands Track (shows colored clips) */}
          <div className="h-6 w-full flex items-center rounded-t-lg overflow-hidden bg-zinc-900/80 border border-b-0 border-zinc-800">
            {segments.map((seg, idx) => {
              const segWidthPct = duration > 0 ? (seg.duration / duration) * 100 : 0;
              const isEven = idx % 2 === 0;
              return (
                <div
                  key={idx}
                  style={{ width: `${segWidthPct}%` }}
                  className={`h-full flex items-center justify-between px-2 text-[10px] font-mono border-r border-zinc-800/80 transition-colors ${
                    isEven
                      ? 'bg-violet-950/30 text-violet-300'
                      : 'bg-indigo-950/30 text-cyan-300'
                  }`}
                  title={`Clip ${idx + 1}: ${formatTimestamp(seg.start)} - ${formatTimestamp(seg.end)} (${seg.duration.toFixed(1)}s)`}
                >
                  <span className="font-semibold truncate">Clip {idx + 1}</span>
                  <span className="text-zinc-500 truncate ml-1">{seg.duration.toFixed(1)}s</span>
                </div>
              );
            })}
          </div>

          {/* Main Interactive Waveform / Thumbnail Filmstrip Track */}
          <div
            ref={trackRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onMouseDown={handleTrackMouseDown}
            className="relative h-20 w-full bg-zinc-900/90 border border-zinc-800 rounded-b-lg overflow-hidden cursor-crosshair group/track"
          >
            {/* Filmstrip Thumbnails Background */}
            {strips.length > 0 ? (
              <div className="absolute inset-0 flex w-full h-full opacity-35 pointer-events-none">
                {strips.map((s, i) => (
                  <div
                    key={i}
                    className="h-full flex-1 border-r border-zinc-800/50 bg-cover bg-center"
                    style={{ backgroundImage: `url(${s})` }}
                  />
                ))}
              </div>
            ) : (
              /* Synthetic Audio / Video Grid Waveform Pattern */
              <div className="absolute inset-0 opacity-20 pointer-events-none flex items-center justify-around px-2">
                {Array.from({ length: 64 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-violet-400 rounded-full"
                    style={{
                      height: `${20 + Math.sin(i * 0.4) * 30 + Math.cos(i * 0.8) * 20}%`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Time ticks ruler */}
            <div className="absolute top-0 inset-x-0 h-4 flex justify-between px-2 text-[9px] font-mono text-zinc-500 border-b border-zinc-800/40 pointer-events-none">
              <span>00:00.000</span>
              <span>{formatTimestamp(duration / 4, true)}</span>
              <span>{formatTimestamp(duration / 2, true)}</span>
              <span>{formatTimestamp((duration * 3) / 4, true)}</span>
              <span>{formatTimestamp(duration, true)}</span>
            </div>

            {/* Hover Timestamp Line & Tooltip (Exact precision indicator) */}
            {hoverX !== null && hoverTime !== null && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-20 flex flex-col items-center"
                style={{ left: `${hoverX}px` }}
              >
                <div className="w-px h-full bg-cyan-400/80 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                <div className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-cyan-500 text-zinc-950 font-mono text-[10px] font-bold shadow-lg shadow-cyan-500/30 whitespace-nowrap">
                  {formatTimestamp(hoverTime, true)}
                </div>
              </div>
            )}

            {/* Current Playhead Line */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none z-30 flex flex-col items-center transition-all duration-75"
              style={{ left: `${playheadPercent}%` }}
            >
              <div className="w-0.5 h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]" />
              {/* Playhead Top Scrubber Badge */}
              <div className="absolute -top-1 w-3.5 h-3.5 bg-white border-2 border-violet-600 rounded-full shadow-lg shadow-violet-500/50 -translate-x-1/2" />
            </div>

            {/* Split Markers (Draggable Flags) */}
            {markers.map((time, idx) => {
              const markerPct = duration > 0 ? (time / duration) * 100 : 0;
              return (
                <div
                  key={idx}
                  onMouseDown={(e) => handleMarkerMouseDown(e, idx)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeek(time);
                  }}
                  className="marker-handle absolute top-0 bottom-0 z-25 group/marker flex flex-col items-center cursor-ew-resize -translate-x-1/2"
                  style={{ left: `${markerPct}%` }}
                  title={`Split Marker #${idx + 1}: ${formatTimestamp(time)} (Drag to adjust, Click to seek)`}
                >
                  {/* Vertical Cut Line */}
                  <div className="w-0.5 h-full bg-violet-500 group-hover/marker:bg-violet-400 group-hover/marker:w-1 transition-all shadow-[0_0_10px_rgba(139,92,246,0.8)]" />

                  {/* Marker Flag Pin */}
                  <div className="absolute top-1 px-1.5 py-0.5 rounded bg-violet-600 text-white font-mono text-[9px] font-bold shadow-lg shadow-violet-600/50 flex items-center gap-1 group-hover/marker:scale-110 transition-transform">
                    <Scissors className="w-2.5 h-2.5" />
                    <span>#{idx + 1}</span>
                  </div>

                  {/* Hover Delete Action Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveMarker(idx);
                    }}
                    className="absolute -bottom-6 p-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg opacity-0 group-hover/marker:opacity-100 transition duration-150 z-40"
                    title="Remove split marker"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Helper text */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-500 px-1 pt-1 border-t border-zinc-900">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-zinc-400" />
          <span>
            Hover timeline for exact timestamp • Drag marker pins to adjust • Press{' '}
            <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-300 font-mono">
              M
            </kbd>{' '}
            to split at playhead
          </span>
        </div>
        <span className="font-mono text-zinc-400">
          Playhead: <span className="text-white font-semibold">{formatTimestamp(currentTime, true)}</span>
        </span>
      </div>
    </div>
  );
};
