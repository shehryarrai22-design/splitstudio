export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  storageQuotaBytes: number;
  status: 'active' | 'suspended';
  createdAt: string;
  usedStorageBytes?: number;
  videoCount?: number;
  jobCount?: number;
}

export interface VideoItem {
  id: string;
  userId: string;
  title: string;
  originalFilename: string;
  filename: string;
  storagePath: string;
  thumbnailPath: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  sizeBytes: number;
  createdAt: string;
  timelineStrips?: string[];
}

export interface SplitClip {
  id: string;
  index: number;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  filename: string;
  storagePath: string;
  sizeBytes: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export type ProcessingMode = 'frame_accurate' | 'stream_copy';
export type OutputResolution = 'original' | '1080p' | '720p' | '480p';

export interface SplitJob {
  id: string;
  userId: string;
  videoId: string;
  videoTitle: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  mode: ProcessingMode;
  resolution: OutputResolution;
  splitPoints: number[];
  clips: SplitClip[];
  progress: number;
  currentClipIndex: number;
  totalClips: number;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface UserStorageStats {
  quotaBytes: number;
  usedBytes: number;
  videoBytes: number;
  clipBytes: number;
  videoCount: number;
  jobCount: number;
  usagePercent: number;
}

export interface PlatformStats {
  totalUsers: number;
  totalVideos: number;
  totalJobs: number;
  totalStorageBytes: number;
  activeJobs: number;
  completedClips: number;
  ffmpegVersion: string;
}
