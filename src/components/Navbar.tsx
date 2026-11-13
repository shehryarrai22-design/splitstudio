import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatBytes } from '../utils/formatters';
import {
  Scissors,
  Film,
  HardDrive,
  Clock,
  ShieldAlert,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'studio' | 'library' | 'jobs' | 'storage' | 'admin';
  setActiveTab: (tab: 'studio' | 'library' | 'jobs' | 'storage' | 'admin') => void;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenAuth }) => {
  const { user, storageStats, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const usedBytes = storageStats?.usedBytes ?? 0;
  const quotaBytes = user?.storageQuotaBytes ?? 1024 * 1024 * 500;
  const usagePct = Math.min(100, Math.round((usedBytes / quotaBytes) * 100));

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <button
            onClick={() => setActiveTab('studio')}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
          >
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-400 p-[1px] shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition">
              <div className="w-full h-full bg-zinc-950 rounded-[11px] flex items-center justify-center">
                <Scissors className="w-4 h-4 text-violet-400 group-hover:rotate-12 transition-transform duration-300" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                  SplitStudio
                </span>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  Pro
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 -mt-0.5 hidden sm:block">
                Precision Video Splitting & Clipping
              </p>
            </div>
          </button>

          {/* Nav Links */}
          {user && (
            <nav className="hidden md:flex items-center gap-1">
              <button
                onClick={() => setActiveTab('studio')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeTab === 'studio'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <Scissors className="w-4 h-4 text-violet-400" />
                <span>Split Studio</span>
              </button>

              <button
                onClick={() => setActiveTab('library')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeTab === 'library'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <Film className="w-4 h-4 text-indigo-400" />
                <span>Library</span>
              </button>

              <button
                onClick={() => setActiveTab('jobs')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeTab === 'jobs'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>Processing Jobs</span>
              </button>

              <button
                onClick={() => setActiveTab('storage')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeTab === 'storage'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span>Storage</span>
              </button>

              {user.role === 'admin' && (
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    activeTab === 'admin'
                      ? 'bg-purple-950/80 text-purple-200 border border-purple-500/30 shadow-sm'
                      : 'text-purple-400 hover:text-purple-200 hover:bg-purple-950/40'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4 text-purple-400 animate-pulse" />
                  <span>Admin Panel</span>
                </button>
              )}
            </nav>
          )}
        </div>

        {/* Right side: Storage meter & User Profile */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Storage pill meter */}
              <button
                onClick={() => setActiveTab('storage')}
                className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs hover:border-zinc-700 transition"
                title="View storage quota details"
              >
                <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-zinc-300 font-mono">
                  {formatBytes(usedBytes)} / {formatBytes(quotaBytes)}
                </span>
                <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      usagePct > 85 ? 'bg-rose-500' : usagePct > 60 ? 'bg-amber-500' : 'bg-gradient-to-r from-violet-500 to-cyan-400'
                    }`}
                    style={{ width: `${Math.max(4, usagePct)}%` }}
                  />
                </div>
              </button>

              {/* User dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:block text-left text-xs">
                    <div className="font-medium text-zinc-200 leading-tight truncate max-w-[120px]">
                      {user.name}
                    </div>
                    <div className="text-[10px] text-zinc-500 capitalize">{user.role}</div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400 ml-0.5" />
                </button>

                {dropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                    onMouseLeave={() => setDropdownOpen(false)}
                  >
                    <div className="px-3 py-2 border-b border-zinc-800/80">
                      <p className="text-xs font-medium text-zinc-200">{user.name}</p>
                      <p className="text-[11px] text-zinc-400 font-mono truncate">{user.email}</p>
                      <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 font-semibold uppercase">
                        {user.role} Account
                      </span>
                    </div>

                    <div className="py-1">
                      <button
                        onClick={() => {
                          setActiveTab('studio');
                          setDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                      >
                        <Scissors className="w-3.5 h-3.5 text-violet-400" />
                        Split Studio
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab('library');
                          setDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                      >
                        <Film className="w-3.5 h-3.5 text-indigo-400" />
                        Video Library
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab('jobs');
                          setDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                      >
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        Processing Jobs
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab('storage');
                          setDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                      >
                        <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                        Storage & Limits
                      </button>
                      {user.role === 'admin' && (
                        <button
                          onClick={() => {
                            setActiveTab('admin');
                            setDropdownOpen(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-purple-300 hover:bg-purple-950/50 flex items-center gap-2"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                          Admin Console
                        </button>
                      )}
                    </div>

                    <div className="border-t border-zinc-800/80 pt-1">
                      <button
                        onClick={() => {
                          logout();
                          setDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-rose-950/30 flex items-center gap-2"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-600/25 transition"
              >
                <UserIcon className="w-4 h-4" />
                <span>Sign in / Register</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile navigation tab strip */}
      {user && (
        <div className="md:hidden flex items-center justify-around border-t border-zinc-800 bg-zinc-950 px-2 py-1.5 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('studio')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded ${
              activeTab === 'studio' ? 'bg-zinc-800 text-white' : 'text-zinc-400'
            }`}
          >
            <Scissors className="w-3.5 h-3.5 text-violet-400" />
            Studio
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded ${
              activeTab === 'library' ? 'bg-zinc-800 text-white' : 'text-zinc-400'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-indigo-400" />
            Library
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded ${
              activeTab === 'jobs' ? 'bg-zinc-800 text-white' : 'text-zinc-400'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            Jobs
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded ${
              activeTab === 'storage' ? 'bg-zinc-800 text-white' : 'text-zinc-400'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            Storage
          </button>
          {user.role === 'admin' && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded ${
                activeTab === 'admin' ? 'bg-purple-950 text-purple-200' : 'text-purple-400'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Admin
            </button>
          )}
        </div>
      )}
    </header>
  );
};
