import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { SplitStudio } from './components/SplitStudio';
import { VideoLibrary } from './components/VideoLibrary';
import { JobHistory } from './components/JobHistory';
import { StorageSettings } from './components/StorageSettings';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { VideoItem } from './types';
import { Scissors, Sparkles, Shield, Cpu, ExternalLink } from 'lucide-react';

function AppContent() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'studio' | 'library' | 'jobs' | 'storage' | 'admin'>('studio');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [emailVerificationReturn, setEmailVerificationReturn] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get('emailVerified') === '1') {
      setEmailVerificationReturn(true);
      setIsAuthModalOpen(true);

      params.delete('emailVerified');
      const query = params.toString();
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
      );
    }
  }, []);
  const [selectedStudioVideo, setSelectedStudioVideo] = useState<VideoItem | null>(null);

  const handleSelectVideoForStudio = (video: VideoItem) => {
    setSelectedStudioVideo(video);
    setActiveTab('studio');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-400 p-[1px] animate-pulse">
            <div className="w-full h-full bg-zinc-950 rounded-[15px] flex items-center justify-center">
              <Scissors className="w-6 h-6 text-violet-400" />
            </div>
          </div>
          <span className="text-xs font-mono text-zinc-500">Loading SplitStudio...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col selection:bg-violet-500 selection:text-white">
      {/* Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* If user is not logged in and wants to see protected tabs */}
        {!user && activeTab !== 'studio' ? (
          <div className="py-20 text-center max-w-md mx-auto space-y-5 bg-zinc-950/80 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center mx-auto text-white shadow-xl shadow-violet-600/30">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Sign In Required</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Please sign in or create an account to view your private library, processing jobs, and cloud storage.
              </p>
            </div>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-xs shadow-lg shadow-violet-600/30 transition"
            >
              Sign In to Continue
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'studio' && (
              <SplitStudio
                initialVideo={selectedStudioVideo}
                onOpenLibrary={() => setActiveTab('library')}
                onViewJobs={() => setActiveTab('jobs')}
                onRequireAuth={() => setIsAuthModalOpen(true)}
              />
            )}

            {activeTab === 'library' && (
              <VideoLibrary
                onSelectVideo={handleSelectVideoForStudio}
                onOpenUpload={() => {
                  setSelectedStudioVideo(null);
                  setActiveTab('studio');
                }}
              />
            )}

            {activeTab === 'jobs' && <JobHistory />}

            {activeTab === 'storage' && <StorageSettings />}

            {activeTab === 'admin' && <AdminPanel />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950/90 py-6 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-300">SplitStudio</span>
            <span className="text-zinc-600">•</span>
            <span>Online Frame-Accurate Video Splitting Platform</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400">Created by Shehryar Rai</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              FFmpeg 4.4 Engine Active
            </span>
            <span className="text-zinc-600">•</span>
            <span>Secure Cloud Isolation</span>
          </div>
        </div>
      </footer>

      {/* Authentication Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} emailVerificationReturn={emailVerificationReturn} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
