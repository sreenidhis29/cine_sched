import React from 'react';
import Link from 'next/link';

export function Sidebar() {
  const navItems = [
    { label: 'Production Stage', icon: 'theaters', href: '/' },
    { label: 'Shooting Schedule', icon: 'calendar_month', href: '/projects' },
    { label: 'Resource Manager', icon: 'people', href: '#' },
    { label: 'Locations', icon: 'location_on', href: '#' },
    { label: 'Budget Monitor', icon: 'attach_money', href: '#' },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-[280px] bg-background border-r border-outline-variant/30 flex flex-col">
      {/* Logo/Brand Area */}
      <div className="h-16 flex items-center px-6 border-b border-outline-variant/30">
        <div className="w-8 h-8 flex items-center justify-center bg-surface-container-low rounded border border-outline-variant shadow-sm mr-3">
          <span className="material-symbols-outlined text-primary-container text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>theaters</span>
        </div>
        <span className="font-headline-md text-[18px] text-on-surface tracking-tight font-bold uppercase">CineSched</span>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item, i) => (
          <Link key={i} href={item.href} className="flex items-center gap-3 px-3 py-2 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40 transition-colors group">
            <span className="material-symbols-outlined text-[20px] group-hover:text-primary-container transition-colors">{item.icon}</span>
            <span className="font-label-md text-[13px] tracking-wide uppercase">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Action Button */}
      <div className="px-6 py-4">
        <button className="w-full flex items-center justify-center gap-2 bg-primary-container text-on-primary-fixed-variant hover:brightness-110 active:scale-[0.99] font-label-md text-[13px] uppercase tracking-wider py-2.5 rounded transition-all duration-200 font-bold shadow-lg shadow-primary-container/10">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add Scene
        </button>
      </div>

      {/* Footer Navigation */}
      <div className="px-3 py-4 border-t border-outline-variant/30 space-y-1">
        <Link href="#" className="flex items-center gap-3 px-3 py-2 rounded text-on-surface-variant/70 hover:text-on-surface hover:bg-surface-variant/40 transition-colors">
          <span className="material-symbols-outlined text-[18px]">settings</span>
          <span className="font-label-md text-[12px] tracking-wide uppercase">Settings</span>
        </Link>
        <Link href="#" className="flex items-center gap-3 px-3 py-2 rounded text-on-surface-variant/70 hover:text-on-surface hover:bg-surface-variant/40 transition-colors">
          <span className="material-symbols-outlined text-[18px]">help</span>
          <span className="font-label-md text-[12px] tracking-wide uppercase">Support</span>
        </Link>
      </div>
    </aside>
  );
}
