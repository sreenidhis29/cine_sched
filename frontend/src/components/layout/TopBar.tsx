import React from 'react';
import Link from 'next/link';

export function TopBar() {
  return (
    <header className="h-16 border-b border-outline-variant/30 bg-background/80 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-6 pl-[304px]">
      
      {/* Secondary Nav */}
      <nav className="flex items-center gap-6">
        <Link href="/projects" className="font-label-md text-[13px] tracking-wider uppercase text-on-surface border-b-2 border-primary-container pb-1">
          Dashboard
        </Link>
        <Link href="#" className="font-label-md text-[13px] tracking-wider uppercase text-on-surface-variant hover:text-on-surface pb-1">
          Analytics
        </Link>
        <Link href="#" className="font-label-md text-[13px] tracking-wider uppercase text-on-surface-variant hover:text-on-surface pb-1">
          Reports
        </Link>
      </nav>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40 rounded transition-colors">
          <span className="material-symbols-outlined text-[20px]">notifications</span>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-container rounded-full border border-background"></span>
        </button>
        
        <div className="h-6 w-px bg-outline-variant/50"></div>
        
        <button className="flex items-center gap-2 p-1 pl-2 pr-3 rounded-full hover:bg-surface-variant/40 transition-colors border border-outline-variant/30">
          <div className="w-6 h-6 rounded-full bg-surface-variant flex items-center justify-center text-[10px] font-bold text-on-surface">
            JD
          </div>
          <span className="font-label-md text-[12px] text-on-surface">J. Doe</span>
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">expand_more</span>
        </button>
      </div>
      
    </header>
  );
}
