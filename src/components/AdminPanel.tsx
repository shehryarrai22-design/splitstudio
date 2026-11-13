import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { User, SplitJob, PlatformStats } from '../types';
import { formatBytes } from '../utils/formatters';
import {
  ShieldAlert,
  Users,
  Film,
  Clock,
  HardDrive,
  Cpu,
  Search,
  Edit2,
  Trash2,
  StopCircle,
  CheckCircle,
  XCircle,
  Save,
  X,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [jobs, setJobs] = useState<SplitJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'jobs' | 'settings'>('users');
  const [userSearch, setUserSearch] = useState('');

  // Edit user modal
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [editQuotaMB, setEditQuotaMB] = useState<number>(500);
  const [editStatus, setEditStatus] = useState<'active' | 'suspended'>('active');
  const [isSavingUser, setIsSavingUser] = useState(false);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [statsData, usersData, jobsData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers(),
        api.getAdminJobs(),
      ]);
      setStats(statsData);
      setUsers(usersData);
      setJobs(jobsData);
    } catch (err: any) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchAdminData();
    }
  }, [user?.role]);

  if (user?.role !== 'admin') {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Access Restricted</h2>
        <p className="text-sm text-zinc-400">
          This area requires administrator privileges. Please sign in with an administrator account to access this console.
        </p>
      </div>
    );
  }

  const handleOpenEditUser = (u: User) => {
    setEditingUser(u);
    setEditRole(u.role);
    setEditQuotaMB(Math.round(u.storageQuotaBytes / (1024 * 1024)));
    setEditStatus(u.status);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    setIsSavingUser(true);
    try {
      const updated = await api.updateAdminUser(editingUser.id, {
        role: editRole,
        storageQuotaBytes: editQuotaMB * 1024 * 1024,
        status: editStatus,
      });

      setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
      setEditingUser(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update user');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (id === user.id) {
      alert('You cannot delete your own active admin account.');
      return;
    }

    if (!confirm('Are you sure you want to delete this user and all their videos and clips?')) return;

    try {
      await api.deleteAdminUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    }
  };

  const handleCancelAdminJob = async (jobId: string) => {
    try {
      await api.cancelAdminJob(jobId);
      const updatedJobs = await api.getAdminJobs();
      setJobs(updatedJobs);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel job');
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.name.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Admin Console</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Platform Operations & Management
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage users, inspect processing queues, modify storage quotas, and monitor FFmpeg status
          </p>
        </div>

        <button
          onClick={fetchAdminData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs border border-zinc-800 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-violet-400 font-medium">
            <Users className="w-4 h-4" />
            <span>Users</span>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{stats?.totalUsers ?? 0}</p>
          <p className="text-[10px] text-zinc-500">Registered</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-medium">
            <Film className="w-4 h-4" />
            <span>Videos</span>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{stats?.totalVideos ?? 0}</p>
          <p className="text-[10px] text-zinc-500">Uploaded</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-medium">
            <Clock className="w-4 h-4" />
            <span>Jobs</span>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{stats?.totalJobs ?? 0}</p>
          <p className="text-[10px] text-zinc-500">Processed</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <HardDrive className="w-4 h-4" />
            <span>Storage</span>
          </div>
          <p className="text-2xl font-bold text-white font-mono">
            {formatBytes(stats?.totalStorageBytes ?? 0)}
          </p>
          <p className="text-[10px] text-zinc-500">Consumed</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
            <Cpu className="w-4 h-4" />
            <span>Queue</span>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{stats?.activeJobs ?? 0}</p>
          <p className="text-[10px] text-zinc-500">Active jobs</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-purple-400 font-medium">
            <ShieldAlert className="w-4 h-4" />
            <span>Engine</span>
          </div>
          <p className="text-sm font-bold text-white font-mono truncate" title={stats?.ffmpegVersion}>
            FFmpeg 4.4
          </p>
          <p className="text-[10px] text-emerald-400">Native Operational</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition -mb-px ${
            activeTab === 'users'
              ? 'border-violet-500 text-white'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Users & Quotas ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('jobs')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition -mb-px ${
            activeTab === 'jobs'
              ? 'border-violet-500 text-white'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>System Queue ({jobs.length})</span>
        </button>
      </div>

      {/* Tab 1: Users Table */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition w-64 sm:w-80"
              />
            </div>
            <span className="text-xs text-zinc-500">
              Showing {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800/80 font-mono">
                  <tr>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Storage Usage / Limit</th>
                    <th className="p-3.5">Videos</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredUsers.map((u) => {
                    const used = u.usedStorageBytes ?? 0;
                    const quota = u.storageQuotaBytes;
                    const pct = Math.min(100, Math.round((used / quota) * 100));

                    return (
                      <tr key={u.id} className="hover:bg-zinc-800/30 transition">
                        <td className="p-3.5">
                          <div>
                            <span className="font-semibold text-zinc-200">{u.name}</span>
                            <p className="text-[11px] text-zinc-500 font-mono">{u.email}</p>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                              u.role === 'admin'
                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                : 'bg-zinc-800 text-zinc-300'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="space-y-1 w-36">
                            <div className="flex justify-between text-[11px] font-mono text-zinc-300">
                              <span>{formatBytes(used)}</span>
                              <span className="text-zinc-500">/ {formatBytes(quota)}</span>
                            </div>
                            <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  pct > 80 ? 'bg-rose-500' : 'bg-violet-500'
                                }`}
                                style={{ width: `${Math.max(4, pct)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 font-mono text-zinc-300">{u.videoCount ?? 0}</td>
                        <td className="p-3.5">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              u.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
                              title="Edit user role & storage quota"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950 text-zinc-400 hover:text-rose-400 transition"
                              title="Delete user"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: System Processing Jobs Queue */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800/80 font-mono">
                  <tr>
                    <th className="p-3.5">Job ID</th>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">Video Title</th>
                    <th className="p-3.5">Clips</th>
                    <th className="p-3.5">Engine / Res</th>
                    <th className="p-3.5">Status & Progress</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-zinc-800/30 transition">
                      <td className="p-3.5 font-mono text-zinc-400">{job.id.substring(0, 14)}...</td>
                      <td className="p-3.5 font-mono text-zinc-300">{job.userId.substring(0, 12)}...</td>
                      <td className="p-3.5 font-semibold text-white max-w-xs truncate">
                        {job.videoTitle}
                      </td>
                      <td className="p-3.5 font-mono text-cyan-400">{job.clips.length}</td>
                      <td className="p-3.5 font-mono text-zinc-400 capitalize">
                        {job.mode.replace('_', ' ')} • {job.resolution}
                      </td>
                      <td className="p-3.5">
                        <div className="space-y-1 w-28">
                          <span
                            className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                              job.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : job.status === 'processing'
                                ? 'bg-violet-500/10 text-violet-400'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {job.status} {job.status === 'processing' && `${job.progress}%`}
                          </span>
                          {job.status === 'processing' && (
                            <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-violet-500"
                                style={{ width: `${job.progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-right">
                        {(job.status === 'queued' || job.status === 'processing') && (
                          <button
                            onClick={() => handleCancelAdminJob(job.id)}
                            className="px-2.5 py-1 rounded-lg bg-rose-950/40 text-rose-300 border border-rose-900/50 hover:bg-rose-900/60 transition text-[11px]"
                          >
                            Force Kill
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <button
              onClick={() => setEditingUser(null)}
              className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white">Edit User: {editingUser.name}</h3>
            <p className="text-xs text-zinc-400 font-mono">{editingUser.email}</p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="user">Standard User</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Storage Quota (MB)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="100"
                    max="100000"
                    value={editQuotaMB}
                    onChange={(e) => setEditQuotaMB(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  />
                  <span className="flex items-center text-xs text-zinc-400 font-mono px-2">MB</span>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {[500, 1024, 2048, 5120].map((mb) => (
                    <button
                      key={mb}
                      type="button"
                      onClick={() => setEditQuotaMB(mb)}
                      className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-300 hover:bg-zinc-700"
                    >
                      {mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Account Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveUser}
                disabled={isSavingUser}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs shadow-lg transition"
              >
                {isSavingUser ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
