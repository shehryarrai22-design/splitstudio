import React, { useState, useEffect } from 'react';
import { VideoItem } from '../types';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatBytes, formatDuration } from '../utils/formatters';
import {
  Film,
  Scissors,
  Trash2,
  Search,
  Plus,
  Play,
  Clock,
  Sparkles,
  ExternalLink,
  X,
} from 'lucide-react';

interface VideoLibraryProps {
  onSelectVideo: (video: VideoItem) => void;
  onOpenUpload: () => void;
}

export const VideoLibrary: React.FC<VideoLibraryProps> = ({ onSelectVideo, onOpenUpload }) => {
  const { refreshStorage } = useAuth();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewVideo, setPreviewVideo] = useState<VideoItem | null>(null);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const data = await api.getVideos();
      setVideos(data);
    } catch (e) {
      console.error('Failed to fetch videos:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleDeleteVideo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this video and free up storage?')) return;

    try {
      await api.deleteVideo(id);
      setVideos((prev) => prev.filter((v) => v.id !== id));
      await refreshStorage();
    } catch (err: any) {
      alert(err.message || 'Failed to delete video');
    }
  };

  const filteredVideos = videos.filter((v) =>
    v.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Film className="w-6 h-6 text-indigo-400" />
            <span>Video Library</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage your uploaded source videos and load them into SplitStudio
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition w-48 sm:w-64"
            />
          </div>

          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/25 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Upload New</span>
          </button>
        </div>
      </div>

      {/* Videos Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="text-center py-16 bg-zinc-950/60 rounded-3xl border border-zinc-800/80 p-8 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <Film className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-200">No videos in your library yet</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
              Upload a video or generate an instant test sample to get started with splitting.
            </p>
          </div>
          <button
            onClick={onOpenUpload}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/30 transition"
          >
            Upload or Try Sample Video
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              onClick={() => onSelectVideo(video)}
              className="group bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 hover:border-violet-500/60 rounded-2xl overflow-hidden shadow-lg hover:shadow-violet-500/10 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video w-full bg-zinc-950 overflow-hidden">
                {video.thumbnailPath ? (
                  <img
                    src={api.getVideoThumbnailUrl(video.id)}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                    <Film className="w-10 h-10" />
                  </div>
                )}

                {/* Duration Badge */}
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[10px] font-mono text-white flex items-center gap-1 font-semibold">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>{formatDuration(video.duration)}</span>
                </div>

                {/* Hover Play Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewVideo(video);
                    }}
                    className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white transition transform hover:scale-110"
                    title="Quick stream preview"
                  >
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  </button>
                </div>
              </div>

              {/* Video Info Card Body */}
              <div className="p-3.5 space-y-2">
                <h3 className="font-semibold text-sm text-zinc-100 truncate group-hover:text-violet-400 transition">
                  {video.title}
                </h3>

                <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                  <span>
                    {video.width}x{video.height} • {video.fps}fps
                  </span>
                  <span>{formatBytes(video.sizeBytes)}</span>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onSelectVideo(video)}
                    className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 font-medium"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Open in Studio</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteVideo(video.id, e)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition"
                    title="Delete video"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Stream Preview Modal */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl p-4">
            <button
              onClick={() => setPreviewVideo(null)}
              className="absolute top-3 right-3 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-semibold text-white mb-3 truncate pr-8">
              {previewVideo.title}
            </h3>
            <div className="aspect-video w-full bg-black rounded-xl overflow-hidden">
              <video
                src={api.getVideoStreamUrl(previewVideo.id)}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
