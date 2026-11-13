import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const archiver = require('archiver');
import { createServer as createViteServer } from 'vite';

import { db, UPLOADS_DIR, THUMBS_DIR, CLIPS_DIR } from './server/db.js';
import {
  createSession,
  removeSession,
  authenticate,
  requireAdmin,
  AuthenticatedRequest,
  extractToken,
  getUserFromToken,
  hashPassword,
  comparePassword,
} from './server/auth.js';
import {
  probeVideo,
  generateThumbnail,
  generateTimelineThumbnails,
  getFFmpegVersion,
  generateSampleHDVideo,
} from './server/ffmpeg.js';
import { enqueueJob, cancelJob } from './server/queue.js';
import { SplitJob, SplitClip, VideoItem } from './server/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 8080);
app.set('trust proxy', 1);

// Lightweight health check for Cloud Run startup and liveness probes.
app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok' }));

app.use(cors());
app.use(express.json());

// Set up Multer for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const user = (req as AuthenticatedRequest).user;
    const dest = path.join(UPLOADS_DIR, user ? user.id : 'temp');
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
    const uniqueName = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 500, // 500 MB max
  },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(mp4|mov|webm|mkv|avi|m4v)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid video file format. Supported: MP4, MOV, WEBM, MKV, AVI'));
    }
  },
});

// Helper: HTTP 206 Partial Content range video streaming
function streamVideoFile(req: Request, res: Response, filePath: string, mimeType = 'video/mp4') {
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video file not found' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).send(`Requested range not satisfiable\n${start} >= ${fileSize}`);
      return;
    }

    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': mimeType,
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
}

// ----------------------------------------------------
// AUTHENTICATION ROUTES
// ----------------------------------------------------



app.post('/api/auth/complete-registration', async (req, res) => {
  const { name, password, idToken } = req.body || {};

  const normalizedName = String(name || '').trim();
  const normalizedPassword = String(password || '');
  const firebaseIdToken = String(idToken || '');

  if (!normalizedName || !normalizedPassword || !firebaseIdToken) {
    return res.status(400).json({
      error: 'Name, password, and verified email are required',
    });
  }

  if (normalizedName.length < 2) {
    return res.status(400).json({ error: 'Please enter your full name' });
  }

  if (normalizedPassword.length < 6) {
    return res.status(400).json({
      error: 'Password must be at least 6 characters long',
    });
  }

  const apiKey = process.env.FIREBASE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'Firebase authentication is not configured on the server',
    });
  }

  try {
    const firebaseResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: firebaseIdToken }),
      }
    );

    const firebaseData = await firebaseResponse.json() as {
      users?: Array<{
        email?: string;
        emailVerified?: boolean;
      }>;
    };

    const firebaseUser = firebaseData.users?.[0];

    if (!firebaseResponse.ok || !firebaseUser?.email) {
      return res.status(401).json({
        error: 'Invalid or expired verification session. Please try again.',
      });
    }

    if (firebaseUser.emailVerified !== true) {
      return res.status(403).json({
        error: 'Please verify your email before creating your account.',
      });
    }

    const verifiedEmail = firebaseUser.email.trim().toLowerCase();

    if (db.getUserByEmail(verifiedEmail)) {
      return res.status(409).json({
        error: 'An account with this email already exists. Please log in.',
      });
    }

    const settings = db.getSettings();
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newUser = db.createUser({
      id: userId,
      email: verifiedEmail,
      name: normalizedName,
      passwordHash: hashPassword(normalizedPassword),
      role: 'user',
      storageQuotaBytes: settings.defaultQuotaBytes,
      status: 'active',
      createdAt: new Date().toISOString(),
    });

    const token = createSession(newUser.id);
    const { passwordHash: _, ...userSafe } = newUser;

    return res.status(201).json({ user: userSafe, token });
  } catch (error) {
    console.error('Firebase registration verification failed:', error);
    return res.status(502).json({
      error: 'Unable to verify your email right now. Please try again.',
    });
  }
});

// Block the old unverified registration route.
app.post('/api/auth/register', (_req, res) => {
  return res.status(410).json({ error: 'Email verification is required. Please use the verification signup flow.' });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (user.status === 'suspended') {
    return res.status(403).json({ error: 'Your account has been suspended. Please contact the administrator.' });
  }

  const valid = comparePassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = createSession(user.id);
  const { passwordHash: _, ...userSafe } = user;

  res.json({
    user: userSafe,
    token,
  });
});

app.get('/api/auth/me', authenticate, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const usedStorage = db.getUserStorageBytes(user.id);
  const { passwordHash: _, ...userSafe } = user;

  res.json({
    user: {
      ...userSafe,
      usedStorageBytes: usedStorage,
    },
  });
});

app.post('/api/auth/logout', (req, res) => {
  const token = extractToken(req);
  if (token) {
    removeSession(token);
  }
  res.json({ success: true });
});

// ----------------------------------------------------
// VIDEO ROUTES
// ----------------------------------------------------

// Upload video
app.post('/api/videos/upload', authenticate, upload.single('video'), async (req: AuthenticatedRequest, res) => {
  try {
    const file = req.file;
    const user = req.user!;

    if (!file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    // Check user storage limit
    const currentStorage = db.getUserStorageBytes(user.id);
    if (currentStorage + file.size > user.storageQuotaBytes) {
      // Remove uploaded file
      try { fs.unlinkSync(file.path); } catch (_) {}
      return res.status(400).json({
        error: `Storage limit exceeded. You need ${Math.round((file.size - (user.storageQuotaBytes - currentStorage)) / (1024 * 1024))} MB more space.`,
      });
    }

    // Probe video with FFprobe
    const meta = await probeVideo(file.path);

    // Generate thumbnail
    const thumbFilename = `thumb_${path.parse(file.filename).name}.jpg`;
    const userThumbDir = path.join(THUMBS_DIR, user.id);
    if (!fs.existsSync(userThumbDir)) {
      fs.mkdirSync(userThumbDir, { recursive: true });
    }
    const thumbPath = path.join(userThumbDir, thumbFilename);

    try {
      await generateThumbnail(file.path, thumbPath, Math.min(1.0, meta.duration / 2));
    } catch (e) {
      console.warn('Could not generate primary thumbnail:', e);
    }

    const videoId = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newVideo: VideoItem = {
      id: videoId,
      userId: user.id,
      title: req.body.title || path.parse(file.originalname).name,
      originalFilename: file.originalname,
      filename: file.filename,
      storagePath: file.path,
      thumbnailPath: thumbPath,
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
      fps: meta.fps,
      bitrate: meta.bitrate,
      sizeBytes: file.size,
      createdAt: new Date().toISOString(),
    };

    db.createVideo(newVideo);

    res.status(201).json(newVideo);
  } catch (err: any) {
    console.error('Video upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to process uploaded video' });
  }
});

// Instant Sample Video Generator (for immediate testing without local files)
app.post('/api/videos/create-sample', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const userUploadsDir = path.join(UPLOADS_DIR, user.id);
    if (!fs.existsSync(userUploadsDir)) {
      fs.mkdirSync(userUploadsDir, { recursive: true });
    }

    const filename = `sample_splitstudio_${Date.now()}.mp4`;
    const videoPath = path.join(userUploadsDir, filename);

    // Generate 20-second HD sample video
    await generateSampleHDVideo(videoPath);

    const stats = fs.statSync(videoPath);
    const meta = await probeVideo(videoPath);

    // Generate thumbnail
    const userThumbDir = path.join(THUMBS_DIR, user.id);
    if (!fs.existsSync(userThumbDir)) {
      fs.mkdirSync(userThumbDir, { recursive: true });
    }
    const thumbFilename = `thumb_${path.parse(filename).name}.jpg`;
    const thumbPath = path.join(userThumbDir, thumbFilename);

    await generateThumbnail(videoPath, thumbPath, 2.0);

    const videoId = `vid_sample_${Date.now()}`;
    const sampleVideo: VideoItem = {
      id: videoId,
      userId: user.id,
      title: 'SplitStudio 720p HD Demo (20s)',
      originalFilename: 'SplitStudio_Demo_720p.mp4',
      filename,
      storagePath: videoPath,
      thumbnailPath: thumbPath,
      duration: meta.duration || 20,
      width: meta.width || 1280,
      height: meta.height || 720,
      fps: meta.fps || 30,
      bitrate: meta.bitrate || 200000,
      sizeBytes: stats.size,
      createdAt: new Date().toISOString(),
    };

    db.createVideo(sampleVideo);
    res.status(201).json(sampleVideo);
  } catch (err: any) {
    console.error('Sample generation failed:', err);
    res.status(500).json({ error: 'Failed to generate sample video' });
  }
});

// List videos for current user
app.get('/api/videos', authenticate, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const videos = db.getVideosByUser(user.id);
  res.json(videos);
});

// Get video details + timeline preview strip thumbnails
app.get('/api/videos/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const video = db.getVideoById(req.params.id);

  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }

  // Security check: Only video owner or admin can view
  if (video.userId !== user.id && user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied to this video' });
  }

  // Check if timeline thumbnails exist, generate if not
  const stripDir = path.join(THUMBS_DIR, video.userId, `strips_${video.id}`);
  let strips: string[] = [];

  if (fs.existsSync(stripDir)) {
    strips = fs.readdirSync(stripDir).filter((f) => f.endsWith('.jpg')).sort();
  } else {
    try {
      strips = await generateTimelineThumbnails(video.storagePath, stripDir, 10, video.duration);
    } catch (e) {
      console.warn('Could not generate timeline thumbnails:', e);
    }
  }

  res.json({
    ...video,
    timelineStrips: strips.map((s) => `/api/videos/${video.id}/strip/${s}`),
  });
});

// Stream video content with HTTP 206 range support
app.get('/api/videos/:id/stream', (req, res) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = getUserFromToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const video = db.getVideoById(req.params.id);
  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }

  if (video.userId !== user.id && user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  streamVideoFile(req, res, video.storagePath, 'video/mp4');
});

// Serve video thumbnail
app.get('/api/videos/:id/thumbnail', (req, res) => {
  const video = db.getVideoById(req.params.id);
  if (!video || !video.thumbnailPath || !fs.existsSync(video.thumbnailPath)) {
    return res.status(404).json({ error: 'Thumbnail not found' });
  }
  res.sendFile(video.thumbnailPath);
});

// Serve timeline strip thumbnail
app.get('/api/videos/:id/strip/:filename', (req, res) => {
  const video = db.getVideoById(req.params.id);
  if (!video) return res.status(404).send('Not found');

  const filePath = path.join(THUMBS_DIR, video.userId, `strips_${video.id}`, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
  res.sendFile(filePath);
});

// Delete video
app.delete('/api/videos/:id', authenticate, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const video = db.getVideoById(req.params.id);

  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }

  if (video.userId !== user.id && user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.deleteVideo(video.id);
  res.json({ success: true, message: 'Video deleted successfully' });
});

// ----------------------------------------------------
// SPLIT JOBS & PROCESSING ROUTES
// ----------------------------------------------------

app.post('/api/jobs', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { videoId, splitPoints, mode, resolution, customNames } = req.body;

    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    const video = db.getVideoById(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Source video not found' });
    }

    if (video.userId !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied to this video' });
    }

    // Validate split points
    let points: number[] = Array.isArray(splitPoints) ? splitPoints : [];
    points = points
      .map((p) => Number(p))
      .filter((p) => !isNaN(p) && p > 0.05 && p < video.duration - 0.05)
      .sort((a, b) => a - b);

    // Remove duplicates very close to each other (<0.1s)
    const filteredPoints: number[] = [];
    for (const pt of points) {
      if (
        filteredPoints.length === 0 ||
        pt - filteredPoints[filteredPoints.length - 1] > 0.2
      ) {
        filteredPoints.push(pt);
      }
    }

    if (filteredPoints.length === 0) {
      return res.status(400).json({ error: 'At least one valid split point within video duration is required' });
    }

    // Generate intervals: [0, p1], [p1, p2], ... [pn, duration]
    const boundaries = [0, ...filteredPoints, video.duration];
    const clips: SplitClip[] = [];

    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i];
      const end = boundaries[i + 1];
      const dur = end - start;
      const defaultName = `Clip_${i + 1}`;
      const name = (customNames && customNames[i]) ? customNames[i] : defaultName;

      clips.push({
        id: `clip_${Date.now()}_${i}`,
        index: i,
        name,
        startTime: start,
        endTime: end,
        duration: dur,
        filename: '',
        storagePath: '',
        sizeBytes: 0,
        status: 'pending',
      });
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newJob: SplitJob = {
      id: jobId,
      userId: user.id,
      videoId: video.id,
      videoTitle: video.title,
      status: 'queued',
      mode: mode === 'stream_copy' ? 'stream_copy' : 'frame_accurate',
      resolution: resolution || 'original',
      splitPoints: filteredPoints,
      clips,
      progress: 0,
      currentClipIndex: 0,
      totalClips: clips.length,
      createdAt: new Date().toISOString(),
    };

    db.createJob(newJob);

    // Enqueue for background FFmpeg worker
    enqueueJob(newJob.id);

    res.status(201).json(newJob);
  } catch (err: any) {
    console.error('Create job error:', err);
    res.status(500).json({ error: err.message || 'Failed to create split job' });
  }
});

// List jobs for user
app.get('/api/jobs', authenticate, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const jobs = db.getJobsByUser(user.id);
  res.json(jobs);
});

// Get job details
app.get('/api/jobs/:id', authenticate, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const job = db.getJobById(req.params.id);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.userId !== user.id && user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.json(job);
});

// Cancel active or queued job
app.post('/api/jobs/:id/cancel', authenticate, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const job = db.getJobById(req.params.id);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.userId !== user.id && user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const cancelled = cancelJob(job.id);
  res.json({ success: cancelled, message: 'Cancellation signal sent' });
});

// Delete job history and clips
app.delete('/api/jobs/:id', authenticate, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const job = db.getJobById(req.params.id);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.userId !== user.id && user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.deleteJob(job.id);
  res.json({ success: true });
});

// Stream individual clip
app.get('/api/clips/:jobId/:clipId/stream', (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).send('Unauthorized');

  const user = getUserFromToken(token);
  if (!user) return res.status(401).send('Unauthorized');

  const job = db.getJobById(req.params.jobId);
  if (!job) return res.status(404).send('Job not found');

  if (job.userId !== user.id && user.role !== 'admin') {
    return res.status(403).send('Forbidden');
  }

  const clip = job.clips.find((c) => c.id === req.params.clipId);
  if (!clip || !clip.storagePath || !fs.existsSync(clip.storagePath)) {
    return res.status(404).send('Clip not found');
  }

  streamVideoFile(req, res, clip.storagePath, 'video/mp4');
});

// Download individual clip
app.get('/api/clips/:jobId/:clipId/download', (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).send('Unauthorized');

  const user = getUserFromToken(token);
  if (!user) return res.status(401).send('Unauthorized');

  const job = db.getJobById(req.params.jobId);
  if (!job) return res.status(404).send('Job not found');

  if (job.userId !== user.id && user.role !== 'admin') {
    return res.status(403).send('Forbidden');
  }

  const clip = job.clips.find((c) => c.id === req.params.clipId);
  if (!clip || !clip.storagePath || !fs.existsSync(clip.storagePath)) {
    return res.status(404).send('Clip not found or not finished processing yet');
  }

  const filename = `${clip.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`;
  res.download(clip.storagePath, filename);
});

// Download all clips in job as a single ZIP archive
app.get('/api/jobs/:id/download-zip', (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).send('Unauthorized');

  const user = getUserFromToken(token);
  if (!user) return res.status(401).send('Unauthorized');

  const job = db.getJobById(req.params.id);
  if (!job) return res.status(404).send('Job not found');

  if (job.userId !== user.id && user.role !== 'admin') {
    return res.status(403).send('Forbidden');
  }

  const completedClips = job.clips.filter((c) => c.status === 'completed' && fs.existsSync(c.storagePath));
  if (completedClips.length === 0) {
    return res.status(400).send('No completed clips available to archive');
  }

  const zipName = `${job.videoTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_Clips.zip`;

  res.attachment(zipName);
  const archive = new (archiver.ZipArchive || archiver)({ zlib: { level: 5 } });

  archive.on('error', (err: any) => {
    console.error('ZIP archive error:', err);
    res.status(500).send({ error: err.message });
  });

  archive.pipe(res);

  completedClips.forEach((clip) => {
    const entryName = `${clip.index + 1}_${clip.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`;
    archive.file(clip.storagePath, { name: entryName });
  });

  archive.finalize();
});

// ----------------------------------------------------
// USER STORAGE & SETTINGS ROUTES
// ----------------------------------------------------

app.get('/api/user/storage', authenticate, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const usedBytes = db.getUserStorageBytes(user.id);
  const userVideos = db.getVideosByUser(user.id);
  const userJobs = db.getJobsByUser(user.id);

  const videoBytes = userVideos.reduce((a, v) => a + v.sizeBytes, 0);
  const clipBytes = usedBytes - videoBytes;

  res.json({
    quotaBytes: user.storageQuotaBytes,
    usedBytes,
    videoBytes,
    clipBytes,
    videoCount: userVideos.length,
    jobCount: userJobs.length,
    usagePercent: Math.min(100, Math.round((usedBytes / user.storageQuotaBytes) * 100)),
  });
});

// ----------------------------------------------------
// ADMIN ROUTES (ROLE = ADMIN ONLY)
// ----------------------------------------------------

// Admin platform statistics
app.get('/api/admin/stats', authenticate, requireAdmin, async (req, res) => {
  const users = db.getUsers();
  const videos = db.getVideos();
  const jobs = db.getJobs();
  const ffmpegVersion = await getFFmpegVersion();

  let totalStorageBytes = 0;
  users.forEach((u) => {
    totalStorageBytes += db.getUserStorageBytes(u.id);
  });

  const activeJobs = jobs.filter((j) => j.status === 'queued' || j.status === 'processing').length;
  const completedClips = jobs.reduce((acc, j) => {
    return acc + j.clips.filter((c) => c.status === 'completed').length;
  }, 0);

  res.json({
    totalUsers: users.length,
    totalVideos: videos.length,
    totalJobs: jobs.length,
    totalStorageBytes,
    activeJobs,
    completedClips,
    ffmpegVersion,
  });
});

// Admin list all users
app.get('/api/admin/users', authenticate, requireAdmin, (req, res) => {
  const users = db.getUsers().map((u) => {
    const { passwordHash: _, ...safe } = u;
    const usedStorage = db.getUserStorageBytes(u.id);
    const videoCount = db.getVideosByUser(u.id).length;
    const jobCount = db.getJobsByUser(u.id).length;
    return {
      ...safe,
      usedStorageBytes: usedStorage,
      videoCount,
      jobCount,
    };
  });

  res.json(users);
});

// Admin update user (role, quota, status)
app.patch('/api/admin/users/:id', authenticate, requireAdmin, (req, res) => {
  const { role, storageQuotaBytes, status } = req.body;
  const targetId = req.params.id;

  const updates: any = {};
  if (role && (role === 'admin' || role === 'user')) updates.role = role;
  if (storageQuotaBytes && typeof storageQuotaBytes === 'number') updates.storageQuotaBytes = storageQuotaBytes;
  if (status && (status === 'active' || status === 'suspended')) updates.status = status;

  const updated = db.updateUser(targetId, updates);
  if (!updated) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { passwordHash: _, ...safe } = updated;
  res.json(safe);
});

// Admin delete user
app.delete('/api/admin/users/:id', authenticate, requireAdmin, (req, res) => {
  const targetId = req.params.id;
  const success = db.deleteUser(targetId);
  if (!success) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ success: true });
});

// Admin list all jobs
app.get('/api/admin/jobs', authenticate, requireAdmin, (req, res) => {
  const jobs = db.getJobs().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(jobs);
});

// Admin cancel any job
app.post('/api/admin/jobs/:id/cancel', authenticate, requireAdmin, (req, res) => {
  const cancelled = cancelJob(req.params.id);
  res.json({ success: cancelled });
});

// Admin global settings
app.get('/api/admin/settings', authenticate, requireAdmin, (req, res) => {
  res.json(db.getSettings());
});

app.patch('/api/admin/settings', authenticate, requireAdmin, (req, res) => {
  const updated = db.updateSettings(req.body);
  res.json(updated);
});

// ----------------------------------------------------
// DEV & PRODUCTION FRONTEND MOUNTING
// ----------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SplitStudio server listening on 0.0.0.0:${PORT}`);
  });
}

startServer().catch((err: any) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
