import React from 'react';
import { formatTimestamp } from '../utils/formatters';
import { Play, Pause, Trash2, Edit3, Scissors, Clock } from 'lucide-react';

export interface SegmentItem {
  index: number;
  name: string;
  start: number;
  end: number;
  duration: number;
}

interface SegmentListProps {
  segments: SegmentItem[];
  onRenameSegment: (index: number, newName: string) => void;
  onPreviewSegment: (start: number, end: number) => void;
  onSeek: (time: number) => void;
  onRemoveMarker?: (markerIndex: number) => void;
  activePreviewRange?: { start: number; end: number } | null;
}

export const SegmentList: React.FC<SegmentListProps> = ({
  segments,
  onRenameSegment,
  onPreviewSegment,
  onSeek,
  onRemoveMarker,
  activePreviewRange,
}) => {
  return (
    <div className="bg-zinc-950/90 rounded-2xl border border-zinc-800/80 p-4 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-violet-400" />
          <h3 className="font-semibold text-sm text-white">
            Resulting Clips ({segments.length})
          </h3>
        </div>
        <span className="text-xs text-zinc-500">
          All clips will be exported frame-accurately
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
        {segments.map((seg, idx) => {
          const isPreviewing =
            activePreviewRange &&
            Math.abs(activePreviewRange.start - seg.start) < 0.1 &&
            Math.abs(activePreviewRange.end - seg.end) < 0.1;

          return (
            <div
              key={idx}
              className={`p-3 rounded-xl border transition-all duration-150 flex flex-col justify-between ${
                isPreviewing
                  ? 'bg-indigo-950/40 border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                  : 'bg-zinc-900/80 border-zinc-800/90 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className="w-5 h-5 rounded-md bg-zinc-800 flex items-center justify-center text-[10px] font-mono text-zinc-300 font-bold shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={seg.name}
                    onChange={(e) => onRenameSegment(idx, e.target.value)}
                    placeholder={`Clip ${idx + 1}`}
                    className="w-full bg-transparent hover:bg-zinc-950 focus:bg-zinc-950 border border-transparent focus:border-violet-500 rounded px-1.5 py-0.5 text-xs text-zinc-200 font-medium focus:outline-none transition"
                  />
                </div>

                {/* Duration badge */}
                <div className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 shrink-0">
                  <Clock className="w-3 h-3" />
                  <span>{seg.duration.toFixed(1)}s</span>
                </div>
              </div>

              {/* Time Range */}
              <div className="flex items-center justify-between text-xs text-zinc-400 font-mono py-1 border-t border-zinc-800/60 mb-2">
                <button
                  onClick={() => onSeek(seg.start)}
                  className="hover:text-cyan-400 transition"
                  title="Seek to start of clip"
                >
                  {formatTimestamp(seg.start)}
                </button>
                <span className="text-zinc-600">→</span>
                <button
                  onClick={() => onSeek(seg.end)}
                  className="hover:text-cyan-400 transition"
                  title="Seek to end of clip"
                >
                  {formatTimestamp(seg.end)}
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => onPreviewSegment(seg.start, seg.end)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    isPreviewing
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  }`}
                >
                  {isPreviewing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
                  <span>{isPreviewing ? 'Stop Preview' : 'Play Segment'}</span>
                </button>

                {onRemoveMarker && idx < segments.length - 1 && (
                  <button
                    onClick={() => onRemoveMarker(idx)}
                    className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition"
                    title={`Remove split marker between Clip ${idx + 1} and Clip ${idx + 2}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
