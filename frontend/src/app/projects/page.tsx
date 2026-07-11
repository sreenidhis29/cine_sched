'use client';

import React from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';

export default function DashboardPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    try {
      const data = await apiClient.get('/api/projects');
      if (data) {
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

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to permanently delete this project? This will delete all associated scenes, cast, locations, and schedules.')) return;
    setLoading(true);
    try {
      await apiClient.delete(`/api/projects/${id}`);
      window.dispatchEvent(new CustomEvent('new-notification', { 
        detail: { title: 'Project Deleted', message: `Permanently removed project and all associated scheduling logs.` } 
      }));
      fetchProjects();
    } catch (err) {
      console.error(err);
      alert('Failed to delete project');
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="py-stack-md animate-in fade-in duration-500">
        <div className="flex justify-between items-center mb-stack-lg">
          <div>
            <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">Production Portfolio</h1>
            <p className="font-body-lg text-on-surface-variant mt-1">Manage active projects and scheduling constraints.</p>
          </div>
          <Link href="/projects/new">
            <button className="flex items-center gap-2 bg-primary-container text-on-primary-fixed-variant px-4 py-2 rounded font-label-md uppercase tracking-wider font-bold shadow-lg hover:brightness-110 active:scale-[0.99] transition-all">
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Project
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="overflow-hidden flex flex-col h-[320px] bg-surface-container/50 border-outline-variant/30 animate-pulse">
                <div className="h-32 bg-surface-bright w-full" />
                <div className="p-panel-padding flex-1 flex flex-col gap-4">
                  <div className="h-6 bg-surface-bright rounded w-3/4" />
                  <div className="mt-auto space-y-4">
                    <div className="h-4 bg-surface-bright rounded w-1/2" />
                    <div className="h-2 bg-surface-bright rounded-full w-full" />
                  </div>
                </div>
              </Card>
            ))
          ) : projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card interactive className="overflow-hidden flex flex-col h-full hover:border-primary-container relative group/card">
                <div className={`h-32 ${p.imgColor} w-full relative`}>
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low to-transparent" />
                  <div className="absolute top-3 left-3">
                    <StatusBadge status={p.status as any} />
                  </div>
                  <div className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 transition-opacity z-20">
                    <button 
                      onClick={(e) => handleDeleteProject(e, p.id)}
                      className="p-1.5 rounded-full bg-surface-container-low/80 hover:bg-error hover:text-white text-on-surface-variant transition-colors backdrop-blur-sm shadow-md flex items-center justify-center"
                      title="Delete Project"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
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
          
          <Link href="/projects/new">
            <Card interactive className="border-dashed border-2 border-outline-variant/50 hover:border-primary-container/50 bg-transparent flex flex-col items-center justify-center h-[320px] text-on-surface-variant hover:text-primary-container transition-colors group">
              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center mb-4 group-hover:bg-primary-container/10 transition-colors">
                <span className="material-symbols-outlined text-[24px]">add</span>
              </div>
              <span className="font-headline-md text-on-surface group-hover:text-primary-container transition-colors">Create New Project</span>
            </Card>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
