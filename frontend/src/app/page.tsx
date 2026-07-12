'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function HeroPage() {
  const router = useRouter();

  useEffect(() => {
    // If user is already logged in, redirect to projects list
    const token = sessionStorage.getItem('access_token');
    if (token) {
      router.push('/projects');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-background text-on-surface select-none overflow-x-hidden font-body-md">

      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-surface-dim/80 backdrop-blur-md border-b border-outline-variant">
        <div className="flex justify-between items-center px-gutter py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <img src="/logo.png" className="w-10 h-10 object-contain rounded" alt="CineFlow Pro Logo" />
            <span className="font-headline-md text-headline-md font-bold text-primary tracking-tight">CINE SCHED</span>
          </div>

          <div className="hidden md:flex gap-8">
            <a href="#" className="font-body-md text-primary font-bold border-b-2 border-primary pb-1">Platform</a>
            <a href="#" className="font-body-md text-on-surface-variant hover:text-primary transition-colors duration-200">Agents</a>
            <a href="#" className="font-body-md text-on-surface-variant hover:text-primary transition-colors duration-200">Constraints</a>
            <a href="#" className="font-body-md text-on-surface-variant hover:text-primary transition-colors duration-200">Pricing</a>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="font-body-md text-on-surface-variant hover:text-primary transition-all font-semibold"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="bg-primary-container text-on-primary-fixed font-bold px-6 py-2 rounded transition-all active:opacity-80 active:scale-95 shadow-lg shadow-primary-container/10 hover:brightness-110"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-black/45 z-10"></div>
          <img
            src="/hero-bg.png"
            className="w-full h-full object-cover"
            alt="Professional film production studio at night with cinema camera rigs and tungsten lighting"
          />
          <div className="hero-gradient absolute inset-0 z-20"></div>
        </div>

        <div className="relative z-30 max-w-7xl mx-auto px-margin-safe w-full">
          <div className="max-w-3xl">
            <h1 className="font-display-lg text-display-lg md:text-[64px] md:leading-[1.1] mb-6 text-on-surface">
              AI-Driven <br />
              <span className="text-primary-container">Production Scheduling</span>
            </h1>

            <p className="font-body-lg text-body-lg text-on-surface-variant mb-10 max-w-2xl leading-relaxed">
              The first agentic scheduling platform that genuinely respects your budget, cast availability, and equipment constraints. Let multiple AI agents solve the logistical puzzle for you.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/signup"
                className="bg-primary-container text-on-primary-fixed font-bold px-8 py-4 rounded-lg flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 text-lg shadow-lg hover:shadow-primary-container/20"
              >
                Get Started
                <span className="material-symbols-outlined">arrow_forward</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Floating Data Panels (Decorative) */}
        <div className="hidden lg:block absolute right-[5%] bottom-[15%] z-30 w-96 space-y-4">
          <div className="glass-panel p-panel-padding rounded-xl border-l-4 border-primary-container animate-in fade-in slide-in-from-bottom-5 duration-700 shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono-data text-mono-data text-primary-container uppercase">Constraint Analysis</span>
              <span className="text-[10px] text-on-surface-variant">Live Feed</span>
            </div>
            <div className="space-y-2">
              <div className="h-1 w-full bg-surface-container rounded overflow-hidden">
                <div className="h-full bg-primary-container w-[78%]"></div>
              </div>
              <p className="font-mono-data text-[11px] text-on-surface/70">Resolving Cast Conflict: Lead Actor Block 12</p>
            </div>
          </div>
          <div className="glass-panel p-panel-padding rounded-xl animate-in fade-in slide-in-from-bottom-5 duration-1000 delay-150 shadow-2xl">
            <div className="flex gap-4 items-center">
              <div className="w-12 h-12 rounded bg-surface-container-high flex items-center justify-center">
                <span className="material-symbols-outlined text-primary-container">psychology</span>
              </div>
              <div>
                <p className="font-headline-md text-sm text-on-surface">Agent Consensus</p>
                <p className="font-body-md text-xs text-on-surface-variant">4 Agents on Optimization V2.1</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-surface-container-lowest py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-margin-safe">
          <div className="text-center mb-20">
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-4">Engineered for Production</h2>
            <div className="h-1 w-20 bg-primary-container mx-auto"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Multi-Agent AI */}
            <div className="group glass-panel p-10 rounded-2xl tungsten-glow transition-all duration-300 flex flex-col items-start gap-6">
              <div className="w-16 h-16 rounded-xl bg-surface-container-highest flex items-center justify-center group-hover:bg-primary-container/20 transition-colors">
                <span className="material-symbols-outlined text-4xl text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface mb-3">Multi-Agent AI</h3>
                <p className="font-body-md text-on-surface-variant leading-relaxed">
                  Distinct agents act as your Producer, Line Producer, and Coordinator, reasoning through constraints collaboratively to find the optimal path forward.
                </p>
              </div>
              <div className="mt-auto pt-6 w-full border-t border-outline-variant/30 flex justify-between items-center">
                <span className="font-mono-data text-xs text-primary-container">LOGICAL INFERENCE</span>
                <span className="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
              </div>
            </div>

            {/* Real Constraint Solving */}
            <div className="group glass-panel p-10 rounded-2xl tungsten-glow transition-all duration-300 flex flex-col items-start gap-6">
              <div className="w-16 h-16 rounded-xl bg-surface-container-highest flex items-center justify-center group-hover:bg-primary-container/20 transition-colors">
                <span className="material-symbols-outlined text-4xl text-primary-container">gavel</span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface mb-3">Real Constraint Solving</h3>
                <p className="font-body-md text-on-surface-variant leading-relaxed">
                  We don't just guess. The AI extracts requirements and formulates them for a rigorous CP-SAT constraint solver, ensuring legal and technical compliance.
                </p>
              </div>
              <div className="mt-auto pt-6 w-full border-t border-outline-variant/30 flex justify-between items-center">
                <span className="font-mono-data text-xs text-primary-container">SATISFIABILITY VERIFIED</span>
                <span className="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
              </div>
            </div>

            {/* Live Reasoning Trace */}
            <div className="group glass-panel p-10 rounded-2xl tungsten-glow transition-all duration-300 flex flex-col items-start gap-6">
              <div className="w-16 h-16 rounded-xl bg-surface-container-highest flex items-center justify-center group-hover:bg-primary-container/20 transition-colors">
                <span className="material-symbols-outlined text-4xl text-primary-container">rule</span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface mb-3">Live Reasoning Trace</h3>
                <p className="font-body-md text-on-surface-variant leading-relaxed">
                  Watch the agents think in real-time. Full transparency into how every scheduling decision and relaxation was made. No black boxes.
                </p>
              </div>
              <div className="mt-auto pt-6 w-full border-t border-outline-variant/30 flex justify-between items-center">
                <span className="font-mono-data text-xs text-primary-container">TRACE LOGGING</span>
                <span className="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
              </div>
            </div>
          </div>
        </div>

        {/* Background Decorative Element */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-primary-container/5 blur-[120px] -z-10 rounded-full"></div>
      </section>

      {/* Stats / Trust Section */}
      <section className="bg-surface-dim py-20 border-y border-outline-variant">
        <div className="max-w-7xl mx-auto px-margin-safe grid grid-cols-2 md:grid-cols-4 gap-12">
          <div className="text-center">
            <p className="font-display-lg text-4xl text-primary-container mb-2">98%</p>
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">Constraint Accuracy</p>
          </div>
          <div className="text-center">
            <p className="font-display-lg text-4xl text-primary-container mb-2">40h</p>
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">Weekly Time Saved</p>
          </div>
          <div className="text-center">
            <p className="font-display-lg text-4xl text-primary-container mb-2">12M+</p>
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">Decisions Modeled</p>
          </div>
          <div className="text-center">
            <p className="font-display-lg text-4xl text-primary-container mb-2">24/7</p>
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">Agent Monitoring</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-container-lowest border-t border-outline-variant">
        <div className="flex flex-col md:flex-row justify-between items-center px-margin-safe max-w-7xl mx-auto py-stack-lg gap-stack-md">
          <div className="flex flex-col gap-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <img src="/logo.png" className="w-8 h-8 opacity-80 rounded" alt="Footer Logo" />
              <span className="font-headline-md text-headline-md text-on-surface">CINE SCHED</span>
            </div>
            <p className="font-label-md text-label-md text-on-secondary-container">© 2026 CineSched. Engineered for Production.</p>
          </div>

          <div className="flex flex-wrap justify-center gap-8">
            <a href="#" className="font-label-md text-on-secondary-container hover:text-primary-fixed-dim transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
