import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { VideoMetadata, ProcessingMode, OutputResolution } from './types.js';

const execFileAsync = promisify(execFile);

const FFMPEG_PATH = '/usr/bin/ffmpeg';
const FFPROBE_PATH = '/usr/bin/ffprobe';

export async function getFFmpegVersion(): Promise<string> {
  try {
    const { stdout } = await execFileAsync(FFMPEG_PATH, ['-version']);
    const firstLine = stdout.split('\n')[0] || 'FFmpeg available';
    return firstLine.substring(0, 80);
  } catch (err) {
    return 'FFmpeg installed';
  }
}

export async function probeVideo(filePath: string): Promise<VideoMetadata> {
  const args = [
    '-v', 'error',
    '-show_entries', 'format=duration,size,bit_rate,format_name:stream=codec_name,codec_type,width,height,r_frame_rate,bit_rate',
    '-of', 'json',
    filePath,
  ];

  const { stdout } = await execFileAsync(FFPROBE_PATH, args);
  const data = JSON.parse(stdout);

  const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');
  const audioStream = data.streams?.find((s: any) => s.codec_type === 'audio');

  let fps = 30;
  if (videoStream?.r_frame_rate) {
    const parts = videoStream.r_frame_rate.split('/');
    if (parts.length === 2 && Number(parts[1]) > 0) {
      fps = Math.round((Number(parts[0]) / Number(parts[1])) * 100) / 100;
    }
  }

  const duration = Number(data.format?.duration || videoStream?.duration || 0);
  const width = Number(videoStream?.width || 1280);
  const height = Number(videoStream?.height || 720);
  const bitrate = Number(data.format?.bit_rate || videoStream?.bit_rate || 0);

  return {
    duration,
    width,
    height,
    fps: fps || 30,
    bitrate,
    codec: videoStream?.codec_name || 'unknown',
    audioCodec: audioStream?.codec_name || 'none',
    formatName: data.format?.format_name || 'mp4',
  };
}

export async function generateThumbnail(videoPath: string, outputPath: string, timestampSec = 1): Promise<string> {
  const timeStr = Math.max(0, timestampSec).toFixed(3);
  const args = [
    '-y',
    '-ss', timeStr,
    '-i', videoPath,
    '-vframes', '1',
    '-vf', 'scale=480:-1',
    '-q:v', '3',
    outputPath,
  ];

  await execFileAsync(FFMPEG_PATH, args);
  return outputPath;
}

export async function generateTimelineThumbnails(
  videoPath: string,
  outputDir: string,
  count = 10,
  duration = 10
): Promise<string[]> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const results: string[] = [];
  const step = duration / (count + 1);

  for (let i = 1; i <= count; i++) {
    const t = (i * step).toFixed(2);
    const filename = `strip_${i}.jpg`;
    const outputPath = path.join(outputDir, filename);

    try {
      await execFileAsync(FFMPEG_PATH, [
        '-y',
        '-ss', t,
        '-i', videoPath,
        '-vframes', '1',
        '-vf', 'scale=240:-1',
        '-q:v', '5',
        outputPath,
      ]);
      results.push(filename);
    } catch (e) {
      // Continue if a single frame fails
    }
  }

  return results;
}

export interface CutOptions {
  inputPath: string;
  outputPath: string;
  startTime: number;
  endTime: number;
  mode: ProcessingMode;
  resolution: OutputResolution;
  onProgress?: (percent: number) => void;
}

export function cutVideoSegment(opts: CutOptions): { promise: Promise<void>; cancel: () => void } {
  let isCancelled = false;
  let childProcess: ReturnType<typeof spawn> | null = null;

  const promise = new Promise<void>((resolve, reject) => {
    const duration = Math.max(0.1, opts.endTime - opts.startTime);
    const startStr = opts.startTime.toFixed(3);
    const durationStr = duration.toFixed(3);

    // Build FFmpeg arguments
    const args: string[] = ['-y'];

    if (opts.mode === 'stream_copy') {
      // Stream copy is ultra-fast keyframe-based cut
      args.push(
        '-ss', startStr,
        '-i', opts.inputPath,
        '-t', durationStr,
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        '-movflags', '+faststart',
        opts.outputPath
      );
    } else {
      // Frame-accurate re-encode
      args.push('-ss', startStr, '-i', opts.inputPath, '-t', durationStr);

      const filterParts: string[] = [];
      if (opts.resolution === '1080p') filterParts.push('scale=-2:1080');
      else if (opts.resolution === '720p') filterParts.push('scale=-2:720');
      else if (opts.resolution === '480p') filterParts.push('scale=-2:480');

      if (filterParts.length > 0) {
        args.push('-vf', filterParts.join(','));
      }

      args.push(
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '21',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        '-progress', 'pipe:1',
        opts.outputPath
      );
    }

    childProcess = spawn(FFMPEG_PATH, args);

    let progressOutput = '';
    childProcess.stdout?.on('data', (data) => {
      progressOutput += data.toString();
      const lines = progressOutput.split('\n');
      progressOutput = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('out_time_ms=')) {
          const timeMs = Number(line.replace('out_time_ms=', '').trim());
          if (!isNaN(timeMs) && duration > 0) {
            const currentSec = timeMs / 1000000;
            const pct = Math.min(99, Math.round((currentSec / duration) * 100));
            opts.onProgress?.(pct);
          }
        }
      }
    });

    childProcess.stderr?.on('data', () => {
      // FFmpeg logs stderr
    });

    childProcess.on('close', (code) => {
      if (isCancelled) {
        if (fs.existsSync(opts.outputPath)) {
          try { fs.unlinkSync(opts.outputPath); } catch (_) {}
        }
        reject(new Error('Process cancelled by user'));
      } else if (code === 0) {
        opts.onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with error code ${code}`));
      }
    });

    childProcess.on('error', (err) => {
      reject(err);
    });
  });

  return {
    promise,
    cancel: () => {
      isCancelled = true;
      if (childProcess) {
        childProcess.kill('SIGKILL');
      }
    },
  };
}

export async function generateSampleHDVideo(outputPath: string): Promise<void> {
  // Generates a 20-second sample HD video with moving color blocks, test pattern, and countdown
  const args = [
    '-y',
    '-f', 'lavfi',
    '-i', 'testsrc=duration=20:size=1280x720:rate=30',
    '-f', 'lavfi',
    '-i', 'sine=frequency=520:duration=20',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    outputPath,
  ];

  await execFileAsync(FFMPEG_PATH, args);
}
