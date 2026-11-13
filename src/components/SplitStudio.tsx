import React, { useState, useEffect, useCallback } from 'react';
import { VideoItem, SplitJob } from '../types';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatBytes, formatDuration, formatBitrate } from '../utils/formatters';
import { VideoPlayer } from './VideoPlayer';
import { InteractiveTimeline } from './InteractiveTimeline';
import { SegmentList, SegmentItem } from './SegmentList';
import { ExportModal } from './ExportModal';
import {
  UploadCloud,
  Sparkles,
  Film,
  Scissors,
  CheckCircle,
  AlertCircle,
  FileVideo,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface SplitStudioProps {
  initialVideo?: VideoItem | null;
  onOpenLibrary: () => void;
  onViewJobs: () => void;
  onRequireAuth: () => void;
}

export const SplitStudio: React.FC<SplitStudioProps> = ({
  initialVideo,
  onOpenLibrary,
  onViewJobs,
  onRequireAuth,
}) => {
  const { user, refreshStorage } = useAuth();

  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(initialVideo || null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [markers, setMarkers] = useState<number[]>([]);
  const [clipNames, setClipNames] = useState<string[]>([]);
  const [loopRange, setLoopRange] = useState<{ start: number; end: number } | null>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Sync if initialVideo changes from outside
  useEffect(() => {
    if (initialVideo) {
      setActiveVideo(initialVideo);
      setCurrentTime(0);
      setMarkers([]);
      setClipNames([]);
      setLoopRange(null);
    }
  }, [initialVideo]);

  // Regenerate clip names when markers change if not custom
  useEffect(() => {
    const totalClips = markers.length + 1;
    setClipNames((prev) => {
      const updated: string[] = [];
      for (let i = 0; i < totalClips; i++) {
        updated.push(prev[i] || `Clip_${i + 1}`);
      }
      return updated;
    });
  }, [markers.length]);

  // Load video strips if active video selected
  useEffect(() => {
    if (activeVideo && !activeVideo.timelineStrips) {
      api.getVideo(activeVideo.id).then((full) => {
        if (full.timelineStrips) {
          setActiveVideo((prev) => (prev ? { ...prev, timelineStrips: full.timelineStrips } : null));
        }
      }).catch((e) => console.warn('Could not load strips:', e));
    }
  }, [activeVideo?.id]);

  // File upload handler
  const handleFileUpload = async (file: File) => {
    if (!user) {
      onRequireAuth();
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const uploaded = await api.uploadVideo(file, file.name, (pct) => {
        setUploadProgress(pct);
      });
      setActiveVideo(uploaded);
      setCurrentTime(0);
      setMarkers([]);
      await refreshStorage();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload video');
    } finally {
      setIsUploading(false);
    }
  };

  // 1-Click Sample HD Video Generator
  const handleGenerateSample = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }

    setUploadError(null);
    setIsGeneratingSample(true);

    try {
      const sample = await api.createSampleVideo();
      setActiveVideo(sample);
      setCurrentTime(0);
      setMarkers([]);
      await refreshStorage();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to generate sample video');
    } finally {
      setIsGeneratingSample(false);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Marker Operations
  const handleAddMarker = (time?: number) => {
    if (!activeVideo) return;
    const targetTime = time !== undefined ? time : currentTime;
    if (targetTime <= 0.1 || targetTime >= activeVideo.duration - 0.1) return;

    // Check if marker already exists nearby
    const exists = markers.some((m) => Math.abs(m - targetTime) < 0.2);
    if (exists) return;

    const newMarkers = [...markers, targetTime].sort((a, b) => a - b);
    setMarkers(newMarkers);
  };

  const handleRemoveMarker = (index: number) => {
    setMarkers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateMarker = (index: number, newTime: number) => {
    setMarkers((prev) => {
      const copy = [...prev];
      copy[index] = newTime;
      return copy.sort((a, b) => a - b);
    });
  };

  const handleClearMarkers = () => {
    setMarkers([]);
    setLoopRange(null);
  };

  const handleSplitEqualParts = (parts: number) => {
    if (!activeVideo || parts < 2) return;
    const duration = activeVideo.duration;
    const interval = duration / parts;
    const newMarkers: number[] = [];

    for (let i = 1; i < parts; i++) {
      newMarkers.push(i * interval);
    }
    setMarkers(newMarkers);
  };

  const handleSplitInterval = (intervalSeconds: number) => {
    if (!activeVideo || intervalSeconds <= 0) return;
    const duration = activeVideo.duration;
    const newMarkers: number[] = [];

    let t = intervalSeconds;
    while (t < duration - 0.5) {
      newMarkers.push(t);
      t += intervalSeconds;
    }
    setMarkers(newMarkers);
  };

  // Preview segment loop
  const handlePreviewSegment = (start: number, end: number) => {
    if (loopRange && Math.abs(loopRange.start - start) < 0.1 && Math.abs(loopRange.end - end) < 0.1) {
      setLoopRange(null);
    } else {
      setLoopRange({ start, end });
      setCurrentTime(start);
    }
  };

  const handleRenameSegment = (index: number, newName: string) => {
    setClipNames((prev) => {
      const copy = [...prev];
      copy[index] = newName;
      return copy;
    });
  };

  // Calculate segment items for SegmentList
  const sortedMarkers = [...markers].sort((a, b) => a - b);
  const videoDuration = activeVideo?.duration || 0;
  const boundaries = [0, ...sortedMarkers, videoDuration];
  const segmentItems: SegmentItem[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    segmentItems.push({
      index: i,
      name: clipNames[i] || `Clip_${i + 1}`,
      start,
      end,
      duration: end - start,
    });
  }

  return (
    <div className="space-y-6">
      {/* State A: No video loaded -> Upload & Demo Showcase Hero */}
      {!activeVideo ? (
        <div className="space-y-8 py-6">
          {/* Hero Header */}
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Native Server-Side FFmpeg Engine</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Frame-Accurate Video Splitting <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                At Cloud Speed
              </span>
            </h1>
            <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto">
              Split long videos into short clips, export frame-accurately with millisecond precision,
              or split into equal intervals for YouTube Shorts, Reels, and TikTok.
            </p>
          </div>

          {uploadError && (
            <div className="max-w-xl mx-auto p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Drag & Drop Upload Zone */}
          <div className="max-w-2xl mx-auto">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all duration-200 bg-zinc-950/60 ${
                dragActive
                  ? 'border-violet-500 bg-violet-950/20 shadow-2xl shadow-violet-500/20 scale-[1.01]'
                  : 'border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/avi"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
                disabled={isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />

              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600/20 to-cyan-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-xl">
                  {isUploading ? (
                    <div className="w-8 h-8 border-2 border-violet-400/20 border-t-violet-400 rounded-full animate-spin" />
                  ) : (
                    <UploadCloud className="w-8 h-8" />
                  )}
                </div>

                {isUploading ? (
                  <div className="space-y-2 w-full max-w-xs">
                    <p className="text-sm font-semibold text-white">Uploading & Analyzing Video...</p>
                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-zinc-500 font-mono">{uploadProgress}% complete</p>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-base font-semibold text-zinc-200">
                        Drag and drop your video here, or <span className="text-violet-400 underline">browse</span>
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        MP4, MOV, WEBM, MKV, AVI (Up to 500 MB)
                      </p>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                      {/* Try Sample HD Video Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateSample();
                        }}
                        disabled={isGeneratingSample}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 hover:border-violet-500/60 text-xs font-semibold shadow-lg transition active:scale-95"
                      >
                        {isGeneratingSample ? (
                          <div className="w-4 h-4 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-violet-400" />
                        )}
                        <span>Try Sample 720p HD Video</span>
                      </button>

                      {user && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenLibrary();
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 text-xs transition"
                        >
                          <Film className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Open from Library</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* State B: Active Video Editor View */
        <div className="space-y-6 animate-in fade-in">
          {/* Top Info Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 shadow-lg">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
                <FileVideo className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-white text-base truncate max-w-md sm:max-w-lg">
                  {activeVideo.title}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 font-mono mt-0.5">
                  <span>{formatDuration(activeVideo.duration)}</span>
                  <span>•</span>
                  <span>
                    {activeVideo.width}x{activeVideo.height} ({activeVideo.fps}fps)
                  </span>
                  <span>•</span>
                  <span>{formatBytes(activeVideo.sizeBytes)}</span>
                  <span>•</span>
                  <span>{formatBitrate(activeVideo.bitrate)}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setActiveVideo(null);
                  setMarkers([]);
                  setLoopRange(null);
                }}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs transition"
              >
                Change Video
              </button>

              <button
                onClick={() => setIsExportModalOpen(true)}
                disabled={markers.length === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-semibold text-xs shadow-lg shadow-violet-600/25 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              >
                <Scissors className="w-4 h-4" />
                <span>Export & Split ({markers.length + 1} Clips)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Video Player */}
          <VideoPlayer
            src={api.getVideoStreamUrl(activeVideo.id)}
            duration={activeVideo.duration}
            fps={activeVideo.fps}
            currentTime={currentTime}
            onTimeChange={(t) => setCurrentTime(t)}
            loopRange={loopRange}
            onClearLoop={() => setLoopRange(null)}
          />

          {/* Interactive Timeline with exact timestamps and draggable markers */}
          <InteractiveTimeline
            duration={activeVideo.duration}
            currentTime={currentTime}
            onSeek={(t) => setCurrentTime(t)}
            markers={markers}
            onAddMarker={handleAddMarker}
            onRemoveMarker={handleRemoveMarker}
            onUpdateMarker={handleUpdateMarker}
            onClearMarkers={handleClearMarkers}
            onSplitEqualParts={handleSplitEqualParts}
            onSplitInterval={handleSplitInterval}
            strips={activeVideo.timelineStrips}
          />

          {/* Resulting Clips Table */}
          <SegmentList
            segments={segmentItems}
            onRenameSegment={handleRenameSegment}
            onPreviewSegment={handlePreviewSegment}
            onSeek={(t) => setCurrentTime(t)}
            onRemoveMarker={handleRemoveMarker}
            activePreviewRange={loopRange}
          />

          {/* Export & Processing Modal */}
          <ExportModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            videoTitle={activeVideo.title}
            videoId={activeVideo.id}
            splitPoints={markers}
            clipNames={clipNames}
            onJobCompleted={() => {
              refreshStorage();
            }}
          />
        </div>
      )}
    </div>
  );
};
