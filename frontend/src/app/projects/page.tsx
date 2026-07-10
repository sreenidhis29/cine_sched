'use client';

import React from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useState, useEffect } from 'react';

export default function DashboardPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/projects`;
        const token = localStorage.getItem('access_token');
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          // Map backend data to UI format
          const mapped = data.map((p: any, i: number) => {
            const colors = ['bg-indigo-900', 'bg-amber-900', 'bg-red-900', 'bg-surface-bright'];
            const statuses = ['in-progress', 'completed', 'conflict', 'draft'];
            return {
              id: p.id,
              name: p.name,
              status: statuses[i % statuses.length],
              nextShoot: '2024-11-15', // Placeholder
              budgetUsage: 75 + (i * 10), // Placeholder
              imgColor: colors[i % colors.length]
            };
          });
          setProjects(mapped);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProjects();
  }, []);

  return (
    <AppShell>
      <div className="py-stack-md animate-in fade-in duration-500">
        <div className="flex justify-between items-center mb-stack-lg">
          <div>
            <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">Production Portfolio</h1>
            <p className="font-body-lg text-on-surface-variant mt-1">Manage active projects and scheduling constraints.</p>
          </div>
          <button className="flex items-center gap-2 bg-primary-container text-on-primary-fixed-variant px-4 py-2 rounded font-label-md uppercase tracking-wider font-bold shadow-lg hover:brightness-110 active:scale-[0.99] transition-all">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Project
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card interactive className="overflow-hidden flex flex-col h-full hover:border-primary-container">
                <div className={`h-32 ${p.imgColor} w-full relative`}>
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low to-transparent" />
                  <div className="absolute top-3 left-3">
                    <StatusBadge status={p.status as any} />
                  </div>
                </div>
                <div className="p-panel-padding flex-1 flex flex-col">
                  <h3 className="font-headline-md text-[18px] text-on-surface mb-4 leading-tight">{p.name}</h3>
                  
                  <div className="mt-auto space-y-4">
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                      <span className="font-mono-data text-mono-data">{p.nextShoot}</span>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-label-md uppercase tracking-wider text-on-surface-variant mb-1">
                        <span>Budget</span>
                        <span>{p.budgetUsage}%</span>
                      </div>
                      <div className="h-1 w-full bg-surface-bright rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${p.budgetUsage > 100 ? 'bg-error' : p.budgetUsage > 85 ? 'bg-primary-container' : 'bg-outline'}`}
                          style={{ width: `${Math.min(p.budgetUsage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
          
          <Card interactive className="border-dashed border-2 border-outline-variant/50 hover:border-primary-container/50 bg-transparent flex flex-col items-center justify-center h-[320px] text-on-surface-variant hover:text-primary-container transition-colors group">
            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center mb-4 group-hover:bg-primary-container/10 transition-colors">
              <span className="material-symbols-outlined text-[24px]">add</span>
            </div>
            <span className="font-headline-md text-on-surface group-hover:text-primary-container transition-colors">Create New Project</span>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
