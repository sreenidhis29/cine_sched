'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';

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
      <div className="fixed inset-0 pointer-events-none z-0 opacity-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-container/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary-container/5 blur-[120px] rounded-full"></div>
      </div>

      <main className={`relative z-10 w-full max-w-[400px] animate-in fade-in slide-in-from-bottom-2 duration-700 transition-opacity ${success ? 'opacity-0' : 'opacity-100'}`}>
        {/* Branding Anchor */}
        <div className="flex flex-col items-center mb-stack-lg text-center">
          <div className="w-14 h-14 mb-stack-md flex items-center justify-center bg-surface-container-low rounded-lg border border-outline-variant shadow-lg">
            <span className="material-symbols-outlined text-primary-container text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>theaters</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">CineSched</h1>
          <p className="font-label-md text-label-md text-on-surface-variant/60 uppercase tracking-[0.25em] mt-unit">Create Account</p>
        </div>

        {/* Signup Card */}
        <div className="bg-surface-container-low p-panel-padding rounded border border-outline-variant shadow-xl">
          <form className="space-y-stack-md" onSubmit={handleSignup}>
            <div className="space-y-unit">
              <label className="font-headline-md text-[13px] uppercase tracking-wider text-on-surface-variant block" htmlFor="name">Full Name</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[18px]">person</span>
                <input required type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant rounded p-3 pl-10 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/20 input-focus-ring transition-all duration-200" placeholder="Jane Doe" />
              </div>
            </div>

            <div className="space-y-unit">
              <label className="font-headline-md text-[13px] uppercase tracking-wider text-on-surface-variant block" htmlFor="role">Production House Name</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[18px]">domain</span>
                <input required type="text" id="role" value={role} onChange={(e) => setRole(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant rounded p-3 pl-10 font-body-md text-body-md text-on-surface input-focus-ring transition-all duration-200" placeholder="My Studio" />
              </div>
            </div>
            <div className="space-y-unit">
              <label className="font-headline-md text-[13px] uppercase tracking-wider text-on-surface-variant block" htmlFor="email">Email Address</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[18px]">mail</span>
                <input required type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant rounded p-3 pl-10 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/20 input-focus-ring transition-all duration-200" placeholder="name@studio.com" />
              </div>
            </div>

            <div className="space-y-unit">
              <label className="font-headline-md text-[13px] uppercase tracking-wider text-on-surface-variant block" htmlFor="password">Password</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[18px]">lock</span>
                <input required type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant rounded p-3 pl-10 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/20 input-focus-ring transition-all duration-200" placeholder="••••••••" />
              </div>
            </div>

            <button 
              disabled={loading || success}
              type="submit" 
              className={`w-full font-headline-md text-headline-md py-3.5 rounded transition-all duration-200 mt-stack-md font-bold shadow-lg shadow-primary-container/10 ${
                success 
                  ? 'bg-green-600 text-white' 
                  : loading 
                    ? 'bg-primary-container opacity-80 cursor-not-allowed text-on-primary-fixed-variant' 
                    : 'bg-primary-container hover:brightness-110 active:scale-[0.99] text-on-primary-fixed-variant'
              }`}
            >
              {success ? (
                <><span className="material-symbols-outlined align-middle mr-2 text-[20px]">check_circle</span> ACCOUNT CREATED</>
              ) : loading ? (
                <><span className="material-symbols-outlined animate-spin text-[20px] mr-2 align-middle">sync</span> REGISTERING...</>
              ) : (
                'Sign Up'
              )}
            </button>
            {error && (
              <div className="text-error text-center font-label-md mt-2">
                {error}
              </div>
            )}
          </form>

          <div className="mt-stack-lg pt-stack-md border-t border-outline-variant/30 flex flex-col gap-stack-sm items-center">
            <div className="flex items-center gap-unit">
              <span className="font-body-md text-body-md text-on-surface-variant/50">Already have an account?</span>
              <a href="/login" className="font-label-md text-label-md text-on-surface-variant hover:text-primary-container underline underline-offset-4 decoration-primary-container/30">Log In</a>
            </div>
          </div>
        </div>

        <footer className="mt-stack-lg text-center opacity-40">
          <p className="font-label-md text-label-md text-on-surface-variant tracking-[0.1em]">
            © 2024 CINESCHEDULE AI. AUTHORIZED PERSONNEL ONLY.
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
