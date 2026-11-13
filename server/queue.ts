import fs from 'fs';
import path from 'path';
import { db, CLIPS_DIR } from './db.js';
import { cutVideoSegment, CutOptions } from './ffmpeg.js';
import { SplitJob } from './types.js';

interface ActiveTask {
  jobId: string;
  cancel: () => void;
}

const activeTasks = new Map<string, ActiveTask>();
let isProcessingQueue = false;

export function cancelJob(jobId: string): boolean {
  const task = activeTasks.get(jobId);
  if (task) {
    task.cancel();
    activeTasks.delete(jobId);
  }

  const job = db.getJobById(jobId);
  if (job && (job.status === 'queued' || job.status === 'processing')) {
    db.updateJob(jobId, {
      status: 'cancelled',
      error: 'Job was cancelled by user',
      completedAt: new Date().toISOString(),
    });
    return true;
  }
  return false;
}

export function enqueueJob(jobId: string) {
  triggerQueueWorker();
}

async function triggerQueueWorker() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    const allJobs = db.getJobs();
    const queuedJob = allJobs.find((j) => j.status === 'queued');

    if (!queuedJob) {
      isProcessingQueue = false;
      return;
    }

    await processJob(queuedJob.id);
  } catch (err) {
    console.error('Error in queue worker:', err);
  } finally {
    isProcessingQueue = false;
    // Check if more jobs are queued
    const remainingQueued = db.getJobs().some((j) => j.status === 'queued');
    if (remainingQueued) {
      setImmediate(triggerQueueWorker);
    }
  }
}

async function processJob(jobId: string) {
  const job = db.getJobById(jobId);
  if (!job || job.status !== 'queued') return;

  const video = db.getVideoById(job.videoId);
  if (!video || !fs.existsSync(video.storagePath)) {
    db.updateJob(jobId, {
      status: 'failed',
      error: 'Source video file could not be found on server disk',
      completedAt: new Date().toISOString(),
    });
    return;
  }

  // Create job clip folder
  const jobClipsDir = path.join(CLIPS_DIR, job.userId, job.id);
  if (!fs.existsSync(jobClipsDir)) {
    fs.mkdirSync(jobClipsDir, { recursive: true });
  }

  db.updateJob(jobId, {
    status: 'processing',
    startedAt: new Date().toISOString(),
    progress: 5,
  });

  const totalClips = job.clips.length;

  for (let i = 0; i < totalClips; i++) {
    // Check if job was cancelled
    const currentJob = db.getJobById(jobId);
    if (!currentJob || currentJob.status === 'cancelled') {
      return;
    }

    const clip = currentJob.clips[i];
    clip.status = 'processing';
    db.updateJob(jobId, {
      currentClipIndex: i + 1,
      clips: [...currentJob.clips],
    });

    const clipFilename = `${clip.index + 1}_${clip.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`;
    const clipOutputPath = path.join(jobClipsDir, clipFilename);

    let cancelCurrent: (() => void) | null = null;

    try {
      const cut = cutVideoSegment({
        inputPath: video.storagePath,
        outputPath: clipOutputPath,
        startTime: clip.startTime,
        endTime: clip.endTime,
        mode: job.mode,
        resolution: job.resolution,
        onProgress: (clipPct) => {
          const overallProgress = Math.min(
            99,
            Math.round(((i + clipPct / 100) / totalClips) * 100)
          );
          db.updateJob(jobId, { progress: overallProgress });
        },
      });

      cancelCurrent = cut.cancel;
      activeTasks.set(jobId, { jobId, cancel: cut.cancel });

      await cut.promise;

      activeTasks.delete(jobId);

      const stats = fs.statSync(clipOutputPath);
      clip.status = 'completed';
      clip.filename = clipFilename;
      clip.storagePath = clipOutputPath;
      clip.sizeBytes = stats.size;

      const progress = Math.round(((i + 1) / totalClips) * 100);
      db.updateJob(jobId, {
        clips: [...currentJob.clips],
        progress,
      });
    } catch (err: any) {
      activeTasks.delete(jobId);
      const isCancel = err.message?.includes('cancelled');
      if (isCancel) {
        db.updateJob(jobId, {
          status: 'cancelled',
          error: 'Job was cancelled',
          completedAt: new Date().toISOString(),
        });
        return;
      }

      console.error(`Clip ${i} failed:`, err);
      clip.status = 'failed';
      clip.error = err.message || 'Cut failed';
      db.updateJob(jobId, {
        status: 'failed',
        error: `Failed to process clip ${i + 1}: ${err.message}`,
        completedAt: new Date().toISOString(),
      });
      return;
    }
  }

  db.updateJob(jobId, {
    status: 'completed',
    progress: 100,
    completedAt: new Date().toISOString(),
  });
}
