import React, { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  reload,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  X, Lock, Mail, User, AlertCircle, ArrowRight, ShieldCheck
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  emailVerificationReturn?: boolean;
}

type RegistrationStep = 'details' | 'emailSent' | 'complete';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  emailVerificationReturn = false,
}) => {
  const { login, completeRegistration } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<RegistrationStep>('details');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (emailVerificationReturn) {
      setMode('register');
      setStep('complete');
      setError(null);
    }
  }, [emailVerificationReturn]);

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
        if (name.trim().length < 2) {
          throw new Error('Please enter your full name.');
        }

        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }

        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }

        const credential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

        await sendEmailVerification(credential.user, {
          url: `${window.location.origin}/?emailVerified=1`,
          handleCodeInApp: false,
        });

        setStep('emailSent');
        setPassword('');
        setConfirmPassword('');
      } else if (step === 'complete') {
        await auth.authStateReady();
        const firebaseUser = auth.currentUser;

        if (!firebaseUser || !firebaseUser.email) {
          throw new Error(
            'Your Firebase session is not available. Please open the verification link in the same browser where you signed up.'
          );
        }

        await reload(firebaseUser);

        if (!firebaseUser.emailVerified) {
          throw new Error(
            'Your email is not verified yet. Please click the verification link in your email first.'
          );
        }

        const credential = EmailAuthProvider.credential(
          firebaseUser.email,
          password
        );

        await reauthenticateWithCredential(firebaseUser, credential);

        const idToken = await firebaseUser.getIdToken(true);

        await completeRegistration(name.trim(), password, idToken);

        await signOut(auth);
        onClose();
      }
    } catch (err: any) {
      let message = err.message || 'Something went wrong. Please try again.';

      if (err.code === 'auth/email-already-in-use') {
        message = 'This email already has a Firebase account. Please sign in or contact support if you have not verified it yet.';
      } else if (err.code === 'auth/wrong-password' ||
                 err.code === 'auth/invalid-credential') {
        message = 'The password does not match the password used during signup.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please wait a little and try again.';
      }

      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setError(null);
    setMode(mode === 'login' ? 'register' : 'login');
    setStep('details');
    setPassword('');
    setConfirmPassword('');
  };

  const closeModal = () => {
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8">
        <button
          onClick={closeModal}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/30 mb-3">
            {mode === 'register' && step !== 'details'
              ? <ShieldCheck className="w-6 h-6 text-white" />
              : <Lock className="w-6 h-6 text-white" />}
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {mode === 'login'
              ? 'Welcome to SplitStudio'
              : step === 'emailSent'
                ? 'Check Your Email'
                : step === 'complete'
                  ? 'Complete Your Account'
                  : 'Create your Account'}
          </h2>

          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {mode === 'login'
              ? 'Access your video projects, splits, and cloud processing'
              : step === 'emailSent'
                ? `We sent a verification link to ${email}. Open it to verify your email, then return here to finish creating your account.`
                : step === 'complete'
                  ? 'Your email has been verified. Enter your name and the same password you used during signup.'
                  : 'Join to start precision frame-accurate video splitting'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {step === 'emailSent' && mode === 'register' ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/30 text-sm text-violet-200 text-center">
              <Mail className="w-7 h-7 mx-auto mb-2" />
              Please check your inbox and spam folder. Click the Firebase verification link, then return to this website.
            </div>
            <button
              type="button"
              onClick={closeModal}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 text-white font-medium text-sm"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Full Name
                  </label>
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
              )}

              {mode === 'login' || step === 'details' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Email Address
                    </label>
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
                </>
              ) : (
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-300">
                  Verified email: {auth.currentUser?.email || 'Loading verified email...'}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Password
                </label>
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

              {mode === 'register' && step === 'details' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Confirm Password
                  </label>
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

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-medium text-sm shadow-lg shadow-violet-600/30 transition disabled:opacity-50"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>
                      {mode === 'login'
                        ? 'Sign In'
                        : step === 'complete'
                          ? 'Complete Registration'
                          : 'Send Verification Link'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

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
          </>
        )}
      </div>
    </div>
  );
};
