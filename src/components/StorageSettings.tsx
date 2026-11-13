import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { UserStorageStats } from '../types';
import { formatBytes } from '../utils/formatters';
import {
  HardDrive,
  Film,
  Scissors,
  User,
  Shield,
  Clock,
  Sparkles,
  Server,
  Database,
} from 'lucide-react';

export const StorageSettings: React.FC = () => {
  const { user, refreshStorage } = useAuth();
  const [stats, setStats] = useState<UserStorageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getUserStorage()
      .then((data) => setStats(data))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const usedBytes = stats?.usedBytes ?? 0;
  const quotaBytes = stats?.quotaBytes ?? (user?.storageQuotaBytes || 1024 * 1024 * 500);
  const videoBytes = stats?.videoBytes ?? 0;
  const clipBytes = stats?.clipBytes ?? 0;
  const usagePct = stats?.usagePercent ?? Math.min(100, Math.round((usedBytes / quotaBytes) * 100));

  const availableBytes = Math.max(0, quotaBytes - usedBytes);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <HardDrive className="w-6 h-6 text-emerald-400" />
          <span>Storage & Account Settings</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Monitor your private video storage quota, usage breakdown, and account profile
        </p>
      </div>

      {/* Storage Gauge Card */}
      <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Cloud Storage Usage
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-white font-mono">
                {formatBytes(usedBytes)}
              </span>
              <span className="text-zinc-500 font-mono text-sm">
                / {formatBytes(quotaBytes)} Limit
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-zinc-400">Available Space:</span>
            <p className="text-lg font-bold text-emerald-400 font-mono">
              {formatBytes(availableBytes)} Free
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-4 bg-zinc-950 rounded-full overflow-hidden p-0.5 border border-zinc-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                usagePct > 85
                  ? 'bg-rose-500'
                  : usagePct > 60
                  ? 'bg-amber-500'
                  : 'bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-400'
              }`}
              style={{ width: `${Math.max(2, usagePct)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-500 font-mono">
            <span>0%</span>
            <span>{usagePct}% allocated</span>
            <span>100%</span>
          </div>
        </div>

        {/* Storage Breakdown Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-zinc-800/80">
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-1">
            <div className="flex items-center gap-2 text-xs text-violet-400 font-medium">
              <Film className="w-4 h-4" />
              <span>Source Videos</span>
            </div>
            <p className="text-xl font-bold text-white font-mono">{formatBytes(videoBytes)}</p>
            <p className="text-[11px] text-zinc-500">{stats?.videoCount ?? 0} files stored</p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-1">
            <div className="flex items-center gap-2 text-xs text-cyan-400 font-medium">
              <Scissors className="w-4 h-4" />
              <span>Extracted Clips</span>
            </div>
            <p className="text-xl font-bold text-white font-mono">{formatBytes(clipBytes)}</p>
            <p className="text-[11px] text-zinc-500">Across {stats?.jobCount ?? 0} split jobs</p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-1">
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
              <Database className="w-4 h-4" />
              <span>Free Quota</span>
            </div>
            <p className="text-xl font-bold text-white font-mono">{formatBytes(availableBytes)}</p>
            <p className="text-[11px] text-zinc-500">Ready for next upload</p>
          </div>
        </div>
      </div>

      {/* User Account Profile Card */}
      <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-violet-600/30">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{user?.name}</h2>
            <p className="text-xs text-zinc-400 font-mono">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                {user?.role} Tier
              </span>
              <span className="text-xs text-zinc-500">
                Account ID: <span className="font-mono text-zinc-400">{user?.id}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-zinc-800/80 text-xs text-zinc-400">
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-1.5">
            <span className="text-zinc-500">Storage Limit Policy:</span>
            <p className="text-zinc-200">
              {formatBytes(quotaBytes)} default storage limit assigned to this account. Contact an administrator to adjust limits.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-1.5">
            <span className="text-zinc-500">Video Isolation:</span>
            <p className="text-zinc-200">
              All videos are stored in dedicated private tenant directories. Only you have authorization to preview or download your clips.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
