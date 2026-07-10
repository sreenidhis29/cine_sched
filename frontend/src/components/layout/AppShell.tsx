import React from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Sidebar />
      <div className="flex flex-col min-h-screen">
        <TopBar />
        <main className="flex-1 pl-[280px] p-margin-safe max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
