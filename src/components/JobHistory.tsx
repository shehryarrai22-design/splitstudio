import React, { useState, useEffect } from 'react';
import { SplitJob, SplitClip } from '../types';
import { api } from '../api';
import { formatBytes, formatDuration } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  Download,
  Archive,
  Trash2,
  StopCircle,
  Play,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Zap,
  Scissors,
  X,
} from 'lucide-react';

export const JobHistory: React.FC = () => {
  const { refreshStorage } = useAuth();
  const [jobs, setJobs] = useState<SplitJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'processing' | 'failed'>('all');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [previewClip, setPreviewClip] = useState<{ jobId: string; clip: SplitClip } | null>(null);

  const fetchJobs = async () => {
    try {
      const data = await api.getJobs();
      setJobs(data);
      // Auto-expand first job if none expanded
      if (!expandedJobId && data.length > 0) {
        setExpandedJobId(data[0].id);
      }
    } catch (e) {
      console.error('Failed to fetch jobs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(() => {
      // Poll if any job is processing or queued
      const hasActive = jobs.some((j) => j.status === 'queued' || j.status === 'processing');
      if (hasActive) {
        fetchJobs();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [jobs]);

  const handleCancelJob = async (jobId: string) => {
    try {
      await api.cancelJob(jobId);
      await fetchJobs();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel job');
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job and its generated clips?')) return;
    try {
      await api.deleteJob(jobId);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      await refreshStorage();
    } catch (err: any) {
      alert(err.message || 'Failed to delete job');
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (filter === 'all') return true;
    if (filter === 'processing') return job.status === 'queued' || job.status === 'processing';
    return job.status === filter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Clock className="w-6 h-6 text-cyan-400" />
            <span>Processing History & Clips</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            View background FFmpeg jobs, stream clips, and download ZIP archives
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 text-xs">
          {(['all', 'completed', 'processing', 'failed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg capitalize transition font-medium ${
                filter === f
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-16 bg-zinc-950/60 rounded-3xl border border-zinc-800/80 p-8 space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <Clock className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-zinc-200">No processing jobs found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Jobs will appear here as soon as you split a video in the Split Studio.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => {
            const isExpanded = expandedJobId === job.id;
            const completedCount = job.clips.filter((c) => c.status === 'completed').length;
            const totalClipBytes = job.clips.reduce((acc, c) => acc + (c.sizeBytes || 0), 0);

            return (
              <div
                key={job.id}
                className="bg-zinc-900/80 border border-zinc-800/90 rounded-2xl overflow-hidden shadow-lg transition"
              >
                {/* Job Card Header */}
                <div
                  onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                  className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-zinc-800/40 transition select-none"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        job.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : job.status === 'processing'
                          ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20 animate-pulse'
                          : job.status === 'cancelled'
                          ? 'bg-zinc-800 text-zinc-400'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {job.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : job.status === 'processing' ? (
                        <div className="w-5 h-5 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                      ) : (
                        <Scissors className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-white truncate max-w-xs sm:max-w-md">
                          {job.videoTitle}
                        </h3>
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                            job.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : job.status === 'processing'
                              ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                              : job.status === 'cancelled'
                              ? 'bg-zinc-800 text-zinc-400'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {job.status} {job.status === 'processing' && `${job.progress}%`}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 font-mono mt-1">
                        <span>{job.clips.length} Clips</span>
                        <span>•</span>
                        <span className="capitalize">{job.mode.replace('_', ' ')}</span>
                        <span>•</span>
                        <span>{job.resolution}</span>
                        {totalClipBytes > 0 && (
                          <>
                            <span>•</span>
                            <span>{formatBytes(totalClipBytes)}</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="text-zinc-500">
                          {new Date(job.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions on right */}
                  <div className="flex items-center gap-2">
                    {/* Download ZIP button if completed */}
                    {job.status === 'completed' && completedCount > 0 && (
                      <a
                        href={api.getJobZipDownloadUrl(job.id)}
                        download
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 text-white font-medium text-xs shadow-md shadow-emerald-600/20 transition"
                        title="Download all clips in a ZIP file"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Download ZIP</span>
                      </a>
                    )}

                    {/* Cancel job if running */}
                    {(job.status === 'queued' || job.status === 'processing') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelJob(job.id);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-400 text-xs transition border border-zinc-700"
                      >
                        <StopCircle className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    )}

                    {/* Delete job */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteJob(job.id);
                      }}
                      className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition"
                      title="Delete job and clips"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedJobId(isExpanded ? null : job.id);
                      }}
                      className="p-1 text-zinc-400 hover:text-white"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Progress bar if active */}
                {job.status === 'processing' && (
                  <div className="w-full h-1.5 bg-zinc-800">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                )}

                {/* Expanded Clips Drawer */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-zinc-800/80 bg-zinc-950/60 space-y-3">
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                      <span className="font-semibold text-zinc-200">
                        Generated Clips ({job.clips.length})
                      </span>
                      <span>Click to preview or download</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {job.clips.map((clip) => (
                        <div
                          key={clip.id}
                          className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 flex items-center justify-between gap-3 text-xs transition"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-zinc-200 truncate">
                              {clip.index + 1}. {clip.name}
                            </p>
                            <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                              {clip.duration.toFixed(1)}s • {formatBytes(clip.sizeBytes)}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {clip.status === 'completed' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setPreviewClip({ jobId: job.id, clip })}
                                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
                                  title="Play clip preview"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                </button>

                                <a
                                  href={api.getClipDownloadUrl(job.id, clip.id)}
                                  download
                                  className="p-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white transition"
                                  title="Download clip"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Clip Preview Modal */}
      {previewClip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl p-4">
            <button
              onClick={() => setPreviewClip(null)}
              className="absolute top-3 right-3 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-semibold text-white mb-2 truncate pr-8">
              {previewClip.clip.name} ({previewClip.clip.duration.toFixed(1)}s)
            </h3>
            <div className="aspect-video w-full bg-black rounded-xl overflow-hidden mb-3">
              <video
                src={api.getClipStreamUrl(previewClip.jobId, previewClip.clip.id)}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex justify-end">
              <a
                href={api.getClipDownloadUrl(previewClip.jobId, previewClip.clip.id)}
                download
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/30 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Clip</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
