export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: 'admin' | 'user';
  storageQuotaBytes: number; // e.g. 1024 * 1024 * 500 (500MB)
  status: 'active' | 'suspended';
  createdAt: string;
}

export interface VideoMetadata {
  duration: number; // in seconds
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  codec: string;
  audioCodec: string;
  formatName: string;
}

export interface VideoItem {
  id: string;
  userId: string;
  title: string;
  originalFilename: string;
  filename: string;
  storagePath: string;
  thumbnailPath: string;
  duration: number; // in seconds
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  sizeBytes: number;
  createdAt: string;
}

export interface SplitClip {
  id: string;
  index: number;
  name: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  duration: number; // in seconds
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
  splitPoints: number[]; // timestamps where splits happen
  clips: SplitClip[];
  progress: number; // 0 - 100
  currentClipIndex: number;
  totalClips: number;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface SystemSettings {
  defaultQuotaBytes: number;
  maxUploadSizeBytes: number;
  allowRegistration: boolean;
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
