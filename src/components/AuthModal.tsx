import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Lock, Mail, User, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, sendRegistrationOtp, verifyRegistrationOtp } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await login(email.trim(), password);
        onClose();
      } else if (step === 'details') {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }

        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }

        await sendRegistrationOtp(name.trim(), email.trim(), password);
        setStep('otp');
      } else {
        await verifyRegistrationOtp(email.trim(), otp);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setError(null);
    setMode(mode === 'login' ? 'register' : 'login');
    setStep('details');
    setOtp('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/30 mb-3">
            {mode === 'register' && step === 'otp'
              ? <ShieldCheck className="w-6 h-6 text-white" />
              : <Lock className="w-6 h-6 text-white" />}
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {mode === 'login'
              ? 'Welcome to SplitStudio'
              : step === 'otp'
                ? 'Verify Your Email'
                : 'Create your Account'}
          </h2>

          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {mode === 'login'
              ? 'Access your video projects, splits, and cloud processing'
              : step === 'otp'
                ? `Enter the 6-digit code sent to ${email}`
                : 'Join to start precision frame-accurate video splitting'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && step === 'details' && (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    minLength={2}
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 transition"
                  />
                </div>
              </div>
            </>
          )}

          {(mode === 'login' || step === 'details') && (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                  <input
                    type="password"
                    required
                    minLength={mode === 'register' ? 6 : undefined}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 transition"
                  />
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Enter your password again"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 transition"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {mode === 'register' && step === 'otp' && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">6-Digit Verification Code</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] text-white placeholder-zinc-600 transition"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || (mode === 'register' && step === 'otp' && otp.length !== 6)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-medium text-sm shadow-lg shadow-violet-600/30 transition disabled:opacity-50"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>
                  {mode === 'login'
                    ? 'Sign In'
                    : step === 'otp'
                      ? 'Verify & Create Account'
                      : 'Send Verification Code'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {mode === 'register' && step === 'otp' && (
          <button
            type="button"
            onClick={() => {
              setStep('details');
              setOtp('');
              setError(null);
            }}
            className="w-full mt-3 text-xs text-zinc-400 hover:text-violet-400 transition"
          >
            Back to signup details
          </button>
        )}

        {step === 'details' && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={switchMode}
              className="text-xs text-zinc-400 hover:text-violet-400 transition"
            >
              {mode === 'login'
                ? "Don't have an account? Sign up here"
                : 'Already have an account? Sign in'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
