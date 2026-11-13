export function formatTimestamp(seconds: number, includeMillis = true): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const mmm = String(millis).padStart(3, '0');

  if (includeMillis) {
    return `${mm}:${ss}.${mmm}`;
  }
  return `${mm}:${ss}`;
}

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0s';

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);

  if (mins === 0) {
    return `${secs}.${ms}s`;
  }
  return `${mins}m ${secs}s`;
}

export function formatBytes(bytes: number): string {
  if (isNaN(bytes) || bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function formatBitrate(bitrate: number): string {
  if (!bitrate || isNaN(bitrate)) return 'Auto';
  const mbps = bitrate / 1000000;
  if (mbps >= 1) {
    return `${mbps.toFixed(1)} Mbps`;
  }
  return `${Math.round(bitrate / 1000)} Kbps`;
}
