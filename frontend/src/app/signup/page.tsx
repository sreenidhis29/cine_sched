'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { DottedSurface } from '@/components/ui/DottedSurface';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [role, setRole] = useState('Producer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiClient.post('/api/auth/signup', {
        email: email,
        password: password,
        name: name,
        role: "owner"
      });

      // signup returns the same token structure to auto-login
      sessionStorage.setItem('access_token', data.access_token);
      
      setSuccess(true);
      setTimeout(() => {
        router.push('/projects');
      }, 600);
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-margin-safe overflow-hidden relative">
      {/* Atmospheric Background Effect */}
      <DottedSurface />
      <div className="fixed inset-0 pointer-events-none z-0 opacity-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-container/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary-container/5 blur-[120px] rounded-full"></div>
      </div>

      <main className={`relative z-10 w-full max-w-[400px] animate-in fade-in slide-in-from-bottom-2 duration-700 transition-opacity ${success ? 'opacity-0' : 'opacity-100'}`}>
        {/* Branding Anchor */}
        <div className="flex flex-col items-center mb-stack-lg text-center gap-2">
          <div className="flex items-center gap-3">
            <img src="/logo.png" className="w-10 h-10 object-contain rounded" alt="CineSched Logo" />
            <span className="font-headline-md text-headline-md font-bold text-primary tracking-tight">CINE SCHED</span>
          </div>
          <p className="font-label-md text-label-md text-on-surface-variant/60 uppercase tracking-[0.25em] mt-1">Create Account</p>
        </div>

        {/* Signup Card */}
        <div className="brutal-form">
          <p>
            Welcome,<span>sign up to continue</span>
          </p>

          <button type="button" onClick={() => alert("SSO integration pending authorization setup.")} className="brutal-button">
            <svg className="w-5 h-5 mr-1" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              <path d="M1 1h22v22H1z" fill="none" />
            </svg>
            Continue with Google
          </button>

          <div className="brutal-separator">
            <div />
            <span>OR</span>
            <div />
          </div>

          <form className="w-full space-y-4" onSubmit={handleSignup}>
            <div className="brutal-input-group">
              <label htmlFor="name">Full Name</label>
              <input required type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} className="brutal-input" placeholder="Jane Doe" />
            </div>

            <div className="brutal-input-group">
              <label htmlFor="role">Production House Name</label>
              <input required type="text" id="role" value={role} onChange={(e) => setRole(e.target.value)} className="brutal-input" placeholder="My Studio" />
            </div>

            <div className="brutal-input-group">
              <label htmlFor="email">Email Address</label>
              <input required type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="brutal-input" placeholder="name@studio.com" />
            </div>

            <div className="brutal-input-group">
              <label htmlFor="password">Password</label>
              <input required type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="brutal-input" placeholder="••••••••" />
            </div>

            <button 
              disabled={loading || success}
              type="submit" 
              className="brutal-button mt-2"
            >
              {success ? (
                <><span className="material-symbols-outlined align-middle mr-2 text-[20px]">check_circle</span> ACCOUNT CREATED</>
              ) : loading ? (
                <><span className="material-symbols-outlined animate-spin text-[20px] mr-2 align-middle">sync</span> REGISTERING...</>
              ) : (
                <>
                  Continue
                  <svg className="w-5 h-5 ml-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="m6 17 5-5-5-5" /><path d="m13 17 5-5-5-5" /></svg>
                </>
              )}
            </button>

            {error && (
              <div className="text-red-500 text-center font-bold text-xs mt-2">
                {error}
              </div>
            )}
          </form>

          <div className="w-full mt-4 pt-4 border-t border-outline-variant/30 flex flex-col gap-2 items-center text-xs">
            <div className="flex items-center gap-1">
              <span className="text-on-surface-variant/50">Already have an account?</span>
              <a href="/login" className="text-primary-container font-bold hover:underline">Log In</a>
            </div>
          </div>
        </div>

        <footer className="mt-stack-lg text-center opacity-40">
          <p className="font-label-md text-label-md text-on-surface-variant tracking-[0.1em]">
            © 2026 Cine Sched. AUTHORIZED PERSONNEL ONLY.
          </p>
          <div className="mt-unit flex justify-center gap-gutter">
            <span className="font-mono-data text-mono-data text-on-surface-variant">V 2.4.0</span>
            <span className="font-mono-data text-mono-data text-on-surface-variant">AES-256</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
