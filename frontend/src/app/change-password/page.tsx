'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your temporary invite token.');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccess(true);
      setTimeout(() => router.push('/'), 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to change password. Please check your invite token.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-margin-safe overflow-hidden relative">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-container/10 blur-[120px] rounded-full opacity-30" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary-container/5 blur-[120px] rounded-full opacity-30" />
      </div>

      <main className={`relative z-10 w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-2 duration-700 transition-opacity ${success ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 mb-4 flex items-center justify-center bg-surface-container-low rounded-lg border border-outline-variant shadow-lg">
            <span className="material-symbols-outlined text-primary-container text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>lock_reset</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Set Your Password</h1>
          <p className="font-body-md text-on-surface-variant mt-2 max-w-[320px] leading-relaxed">
            Your account was provisioned with a temporary invite token. Please set a permanent password to continue.
          </p>
        </div>

        <div className="bg-surface-container-low p-panel-padding rounded border border-outline-variant shadow-xl">
          <div className="mb-6 p-3 bg-primary-container/10 border border-primary-container/20 rounded flex items-start gap-3">
            <span className="material-symbols-outlined text-primary-container text-[18px] mt-0.5 flex-shrink-0">info</span>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Enter the invite token you received as your current password, then choose a new password. This is a one-time step.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="font-headline-md text-[13px] uppercase tracking-wider text-on-surface-variant block" htmlFor="current-pw">
                Invite Token (Temporary Password)
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[18px]">vpn_key</span>
                <input
                  required
                  id="current-pw"
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded p-3 pl-10 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/20 focus:border-primary-container outline-none transition-all duration-200"
                  placeholder="Paste invite token here"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-headline-md text-[13px] uppercase tracking-wider text-on-surface-variant block" htmlFor="new-pw">
                New Password
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[18px]">lock</span>
                <input
                  required
                  id="new-pw"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded p-3 pl-10 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/20 focus:border-primary-container outline-none transition-all duration-200"
                  placeholder="Minimum 8 characters"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-headline-md text-[13px] uppercase tracking-wider text-on-surface-variant block" htmlFor="confirm-pw">
                Confirm New Password
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[18px]">lock_open</span>
                <input
                  required
                  id="confirm-pw"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded p-3 pl-10 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/20 focus:border-primary-container outline-none transition-all duration-200"
                  placeholder="Repeat new password"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-error font-label-md text-sm p-3 bg-error/5 border border-error/20 rounded">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {error}
              </div>
            )}

            <button
              disabled={loading || success}
              type="submit"
              className={`w-full font-headline-md py-3.5 rounded transition-all duration-200 mt-2 font-bold shadow-lg shadow-primary-container/10 ${
                success
                  ? 'bg-green-600 text-white'
                  : loading
                    ? 'bg-primary-container opacity-80 cursor-not-allowed text-on-primary-fixed-variant'
                    : 'bg-primary-container hover:brightness-110 active:scale-[0.99] text-on-primary-fixed-variant'
              }`}
            >
              {success ? (
                <><span className="material-symbols-outlined align-middle mr-2 text-[20px]">check_circle</span>PASSWORD SET</>
              ) : loading ? (
                <><span className="material-symbols-outlined animate-spin text-[20px] mr-2 align-middle">sync</span>UPDATING...</>
              ) : (
                'Set My Password'
              )}
            </button>
          </form>
        </div>

        <footer className="mt-6 text-center opacity-40">
          <p className="font-label-md text-label-md text-on-surface-variant tracking-[0.1em]">
            © 2026 Cine Sched — AUTHORIZED PERSONNEL ONLY.
          </p>
        </footer>
      </main>
    </div>
  );
}
