'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function HeroPage() {
  const router = useRouter();

  useEffect(() => {
    // If user is already logged in, redirect to dashboard
    const token = localStorage.getItem('access_token');
    if (token) {
      router.push('/projects');
    }
  }, [router]);

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden bg-background">
      {/* Atmospheric Background Effect (from DESIGN.md) */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-container/20 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent/10 blur-[150px] rounded-full"></div>
      </div>

      <header className="relative z-10 flex justify-between items-center p-6 border-b border-outline-variant/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center bg-surface-container-low rounded border border-outline-variant shadow-sm">
            <span className="material-symbols-outlined text-primary-container text-[24px]">theaters</span>
          </div>
          <span className="font-headline-md font-bold tracking-tight text-on-surface">CineSched</span>
        </div>
        <div>
          <Link href="/login" className="font-label-md uppercase tracking-wider text-on-surface-variant hover:text-primary-container transition-colors mr-6">
            Log In
          </Link>
          <Link href="/signup" className="bg-primary-container text-on-primary-fixed-variant px-5 py-2.5 rounded font-label-md uppercase tracking-wider font-bold shadow-lg hover:brightness-110 active:scale-[0.99] transition-all">
            Get Started
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center max-w-4xl mx-auto w-full">
        <h1 className="font-headline-lg text-5xl md:text-7xl font-extrabold tracking-tight text-on-surface mb-6 leading-tight">
          AI-Driven <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-container to-amber-200">Production Scheduling</span>
        </h1>
        
        <p className="font-body-lg text-xl text-on-surface-variant mb-12 max-w-2xl leading-relaxed">
          The first agentic scheduling platform that genuinely respects your budget, cast availability, and equipment constraints. Let multiple AI agents solve the logistical puzzle for you.
        </p>

        <div className="flex flex-col items-center gap-4 mb-16">
          <Link href="/signup" className="bg-primary-container text-on-primary-fixed-variant px-8 py-4 rounded-lg font-headline-md uppercase tracking-wider font-bold shadow-[0_0_30px_rgba(255,184,0,0.3)] hover:shadow-[0_0_40px_rgba(255,184,0,0.5)] hover:brightness-110 active:scale-[0.99] transition-all">
            Get Started
          </Link>
          <Link href="/login" className="font-label-md text-on-surface-variant hover:text-primary-container transition-colors tracking-wide underline underline-offset-4 decoration-primary-container/30">
            Already have an account? Log in
          </Link>
        </div>

        {/* Capabilities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          
          <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant shadow-md hover:border-primary-container/50 transition-colors">
            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center mb-4 text-primary-container">
              <span className="material-symbols-outlined text-[24px]">psychology</span>
            </div>
            <h3 className="font-headline-md font-bold text-on-surface mb-2">Multi-Agent AI</h3>
            <p className="font-body-md text-on-surface-variant text-sm">
              Distinct agents act as your Producer, Line Producer, and Coordinator, reasoning through constraints collaboratively.
            </p>
          </div>

          <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant shadow-md hover:border-accent/50 transition-colors">
            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center mb-4 text-accent">
              <span className="material-symbols-outlined text-[24px]">gavel</span>
            </div>
            <h3 className="font-headline-md font-bold text-on-surface mb-2">Real Constraint Solving</h3>
            <p className="font-body-md text-on-surface-variant text-sm">
              We don&apos;t just guess. The AI extracts requirements and formulates them for a rigorous CP-SAT constraint solver.
            </p>
          </div>

          <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant shadow-md hover:border-primary-container/50 transition-colors">
            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center mb-4 text-primary-container">
              <span className="material-symbols-outlined text-[24px]">rule</span>
            </div>
            <h3 className="font-headline-md font-bold text-on-surface mb-2">Live Reasoning Trace</h3>
            <p className="font-body-md text-on-surface-variant text-sm">
              Watch the agents think in real-time. Full transparency into how every scheduling decision and relaxation was made.
            </p>
          </div>

        </div>
      </main>

      <footer className="relative z-10 text-center py-8 opacity-60 border-t border-outline-variant/10 mt-auto">
        <p className="font-label-md text-xs text-on-surface-variant tracking-[0.1em]">
          © 2024 CINESCHEDULE AI. ALL RIGHTS RESERVED.
        </p>
      </footer>
    </div>
  );
}
