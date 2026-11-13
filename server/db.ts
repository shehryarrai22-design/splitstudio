import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { User, VideoItem, SplitJob, SystemSettings } from './types.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
export const STORAGE_DIR = path.join(DATA_DIR, 'storage');
export const UPLOADS_DIR = path.join(STORAGE_DIR, 'uploads');
export const CLIPS_DIR = path.join(STORAGE_DIR, 'clips');
export const THUMBS_DIR = path.join(STORAGE_DIR, 'thumbnails');

// Ensure required directories exist
[DATA_DIR, STORAGE_DIR, UPLOADS_DIR, CLIPS_DIR, THUMBS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

interface DatabaseSchema {
  users: User[];
  videos: VideoItem[];
  jobs: SplitJob[];
  settings: SystemSettings;
}

const DEFAULT_SETTINGS: SystemSettings = {
  defaultQuotaBytes: 1024 * 1024 * 500, // 500 MB
  maxUploadSizeBytes: 1024 * 1024 * 250, // 250 MB per file
  allowRegistration: true,
};

function initDb(): DatabaseSchema {
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      console.error('Failed to parse db.json, reinitializing:', err);
    }
  }

  // Seed default admin and demo user
  const adminSalt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('AdminPass123!', adminSalt);
  const demoSalt = bcrypt.genSaltSync(10);
  const demoHash = bcrypt.hashSync('DemoPass123!', demoSalt);

  const initialData: DatabaseSchema = {
    users: [
      {
        id: 'usr_admin_001',
        email: 'shehryarrai22@gmail.com',
        name: 'System Admin',
        passwordHash: adminHash,
        role: 'admin',
        storageQuotaBytes: 1024 * 1024 * 2048, // 2 GB
        status: 'active',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'usr_demo_002',
        email: 'demo@splitstudio.io',
        name: 'Alex Creator',
        passwordHash: demoHash,
        role: 'user',
        storageQuotaBytes: 1024 * 1024 * 500, // 500 MB
        status: 'active',
        createdAt: new Date().toISOString(),
      },
    ],
    videos: [],
    jobs: [],
    settings: DEFAULT_SETTINGS,
  };

  fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
  return initialData;
}

let dbInstance: DatabaseSchema = initDb();

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbInstance, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving db:', err);
  }
}

export const db = {
  // Users
  getUsers: (): User[] => dbInstance.users,
  getUserById: (id: string): User | undefined => dbInstance.users.find((u) => u.id === id),
  getUserByEmail: (email: string): User | undefined =>
    dbInstance.users.find((u) => u.email.toLowerCase() === email.toLowerCase()),
  createUser: (user: User): User => {
    dbInstance.users.push(user);
    saveDb();
    return user;
  },
  updateUser: (id: string, updates: Partial<User>): User | undefined => {
    const user = dbInstance.users.find((u) => u.id === id);
    if (!user) return undefined;
    Object.assign(user, updates);
    saveDb();
    return user;
  },
  deleteUser: (id: string): boolean => {
    const index = dbInstance.users.findIndex((u) => u.id === id);
    if (index === -1) return false;
    dbInstance.users.splice(index, 1);
    // Also delete user's videos and jobs
    dbInstance.videos = dbInstance.videos.filter((v) => v.userId !== id);
    dbInstance.jobs = dbInstance.jobs.filter((j) => j.userId !== id);
    saveDb();
    return true;
  },

  // Videos
  getVideos: (): VideoItem[] => dbInstance.videos,
  getVideosByUser: (userId: string): VideoItem[] =>
    dbInstance.videos.filter((v) => v.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  getVideoById: (id: string): VideoItem | undefined => dbInstance.videos.find((v) => v.id === id),
  createVideo: (video: VideoItem): VideoItem => {
    dbInstance.videos.push(video);
    saveDb();
    return video;
  },
  deleteVideo: (id: string): boolean => {
    const index = dbInstance.videos.findIndex((v) => v.id === id);
    if (index === -1) return false;
    const video = dbInstance.videos[index];
    // Attempt to remove files from disk
    try {
      if (video.storagePath && fs.existsSync(video.storagePath)) {
        fs.unlinkSync(video.storagePath);
      }
      if (video.thumbnailPath && fs.existsSync(video.thumbnailPath)) {
        fs.unlinkSync(video.thumbnailPath);
      }
    } catch (e) {
      console.warn('Could not delete video files from disk:', e);
    }
    dbInstance.videos.splice(index, 1);
    saveDb();
    return true;
  },

  // Jobs
  getJobs: (): SplitJob[] => dbInstance.jobs,
  getJobsByUser: (userId: string): SplitJob[] =>
    dbInstance.jobs.filter((j) => j.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  getJobById: (id: string): SplitJob | undefined => dbInstance.jobs.find((j) => j.id === id),
  createJob: (job: SplitJob): SplitJob => {
    dbInstance.jobs.push(job);
    saveDb();
    return job;
  },
  updateJob: (id: string, updates: Partial<SplitJob>): SplitJob | undefined => {
    const job = dbInstance.jobs.find((j) => j.id === id);
    if (!job) return undefined;
    Object.assign(job, updates);
    saveDb();
    return job;
  },
  deleteJob: (id: string): boolean => {
    const index = dbInstance.jobs.findIndex((j) => j.id === id);
    if (index === -1) return false;
    const job = dbInstance.jobs[index];
    // Remove generated clips from disk
    job.clips.forEach((clip) => {
      if (clip.storagePath && fs.existsSync(clip.storagePath)) {
        try {
          fs.unlinkSync(clip.storagePath);
        } catch (e) {
          console.warn('Could not delete clip:', e);
        }
      }
    });
    dbInstance.jobs.splice(index, 1);
    saveDb();
    return true;
  },

  // Storage calculation for user
  getUserStorageBytes: (userId: string): number => {
    const userVideos = dbInstance.videos.filter((v) => v.userId === userId);
    const videoBytes = userVideos.reduce((acc, v) => acc + (v.sizeBytes || 0), 0);

    const userJobs = dbInstance.jobs.filter((j) => j.userId === userId);
    const clipBytes = userJobs.reduce((acc, j) => {
      return (
        acc +
        j.clips.reduce((clipAcc, c) => {
          return clipAcc + (c.sizeBytes || 0);
        }, 0)
      );
    }, 0);

    return videoBytes + clipBytes;
  },

  // Settings
  getSettings: (): SystemSettings => dbInstance.settings,
  updateSettings: (updates: Partial<SystemSettings>): SystemSettings => {
    Object.assign(dbInstance.settings, updates);
    saveDb();
    return dbInstance.settings;
  },
};
