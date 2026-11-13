import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { SplitJob, ProcessingMode, OutputResolution } from '../types';
import { api } from '../api';
import { formatDuration, formatBytes } from '../utils/formatters';
import {
  X,
  Scissors,
  CheckCircle2,
  AlertCircle,
  Download,
  Archive,
  Cpu,
  Zap,
  Layers,
  StopCircle,
  Sparkles,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoTitle: string;
  videoId: string;
  splitPoints: number[];
  clipNames: string[];
  onJobCompleted?: (job: SplitJob) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  videoTitle,
  videoId,
  splitPoints,
  clipNames,
  onJobCompleted,
}) => {
  const [mode, setMode] = useState<ProcessingMode>('frame_accurate');
  const [resolution, setResolution] = useState<OutputResolution>('original');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeJob, setActiveJob] = useState<SplitJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clipCount = splitPoints.length + 1;

  // Poll for active job progress while processing
  useEffect(() => {
    let interval: any = null;

    if (activeJob && (activeJob.status === 'queued' || activeJob.status === 'processing')) {
      interval = setInterval(async () => {
        try {
          const updated = await api.getJob(activeJob.id);
          setActiveJob(updated);

          if (updated.status === 'completed') {
            clearInterval(interval);
            try {
              confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
              });
            } catch (_) {}
            onJobCompleted?.(updated);
          } else if (updated.status === 'failed' || updated.status === 'cancelled') {
            clearInterval(interval);
          }
        } catch (e: any) {
          console.error('Job polling error:', e);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeJob, onJobCompleted]);

  if (!isOpen) return null;

  const handleStartExport = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const job = await api.createJob({
        videoId,
        splitPoints,
        mode,
        resolution,
        customNames: clipNames,
      });
      setActiveJob(job);
    } catch (err: any) {
      setError(err.message || 'Failed to start export job');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelJob = async () => {
    if (!activeJob) return;
    try {
      await api.cancelJob(activeJob.id);
      const updated = await api.getJob(activeJob.id);
      setActiveJob(updated);
    } catch (e: any) {
      setError(e.message || 'Failed to cancel job');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-600/30">
            <Scissors className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Export & Split Clips
            </h2>
            <p className="text-xs text-zinc-400 truncate max-w-sm">
              Source: <span className="text-zinc-200 font-medium">{videoTitle}</span>
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* State 1: Configuration Form (before submitting) */}
        {!activeJob && (
          <div className="space-y-5">
            {/* Split summary pill */}
            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Total Clips to Produce:</span>
              <span className="font-mono text-cyan-400 font-bold text-sm">
                {clipCount} Clips
              </span>
            </div>

            {/* Mode Selector */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">
                Cutting Engine
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('frame_accurate')}
                  className={`p-3 rounded-xl border text-left transition ${
                    mode === 'frame_accurate'
                      ? 'bg-violet-950/40 border-violet-500 text-white shadow-lg shadow-violet-500/10'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium text-xs mb-1">
                    <Cpu className="w-4 h-4 text-violet-400" />
                    <span className="text-white">Frame-Accurate (Recommended)</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Smart x264 re-encode. Millisecond-accurate cut points with zero glitching or keyframe drift.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('stream_copy')}
                  className={`p-3 rounded-xl border text-left transition ${
                    mode === 'stream_copy'
                      ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium text-xs mb-1">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <span className="text-white">Stream Copy (Instant)</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Ultra-fast stream copying without re-encoding. Cuts at closest keyframes with original bitrate.
                  </p>
                </button>
              </div>
            </div>

            {/* Resolution Selector */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">
                Output Resolution
              </label>
              <div className="grid grid-cols-4 gap-2 text-xs">
                {(['original', '1080p', '720p', '480p'] as OutputResolution[]).map((res) => (
                  <button
                    key={res}
                    type="button"
                    onClick={() => setResolution(res)}
                    className={`py-2 px-3 rounded-xl border font-mono capitalize transition ${
                      resolution === res
                        ? 'bg-violet-600 border-violet-500 text-white font-semibold'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleStartExport}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-medium text-sm shadow-xl shadow-violet-600/30 transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Scissors className="w-4 h-4" />
                    <span>Start Splitting ({clipCount} Clips)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* State 2: Active Background Job Monitor */}
        {activeJob && (
          <div className="space-y-6">
            {/* Status Header */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-400">Processing Status:</span>
                <span
                  className={`text-xs font-semibold uppercase px-2 py-0.5 rounded-full ${
                    activeJob.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : activeJob.status === 'processing'
                      ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20 animate-pulse'
                      : activeJob.status === 'cancelled'
                      ? 'bg-zinc-800 text-zinc-400'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {activeJob.status}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-400 transition-all duration-300"
                  style={{ width: `${activeJob.progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                <span>
                  {activeJob.status === 'completed'
                    ? 'All clips exported!'
                    : `Clip ${activeJob.currentClipIndex || 1} of ${activeJob.totalClips}`}
                </span>
                <span className="text-white font-bold">{activeJob.progress}%</span>
              </div>
            </div>

            {/* Cancel Button if processing */}
            {(activeJob.status === 'queued' || activeJob.status === 'processing') && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleCancelJob}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-400 border border-zinc-700 hover:border-rose-900/50 text-xs transition"
                >
                  <StopCircle className="w-4 h-4" />
                  <span>Cancel Job</span>
                </button>
              </div>
            )}

            {/* Completed Clips List & Download Actions */}
            {activeJob.status === 'completed' && (
              <div className="space-y-4 animate-in fade-in">
                {/* Download All ZIP button */}
                <a
                  href={api.getJobZipDownloadUrl(activeJob.id)}
                  download
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-sm shadow-xl shadow-emerald-600/25 transition"
                >
                  <Archive className="w-4 h-4" />
                  <span>Download All as ZIP Archive</span>
                </a>

                {/* Individual Clips List */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {activeJob.clips.map((clip) => (
                    <div
                      key={clip.id}
                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zinc-200 truncate">
                          {clip.index + 1}. {clip.name}
                        </p>
                        <p className="text-[11px] text-zinc-500 font-mono">
                          {clip.duration.toFixed(1)}s • {formatBytes(clip.sizeBytes)}
                        </p>
                      </div>

                      <a
                        href={api.getClipDownloadUrl(activeJob.id, clip.id)}
                        download
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-violet-600 text-zinc-200 hover:text-white transition font-medium text-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs transition"
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
