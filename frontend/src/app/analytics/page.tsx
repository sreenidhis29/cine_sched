'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { ProjectSelector } from '@/components/ui/ProjectSelector';
import { Card } from '@/components/ui/Card';
import { apiClient } from '@/lib/apiClient';

export default function AnalyticsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('projectId') || '';
  const [projectId, setProjectId] = useState<string>(initialProjectId);

  const handleProjectSelect = (id: string) => {
    setProjectId(id);
    router.replace(`${pathname}?projectId=${id}`);
  };
  
  const [stats, setStats] = useState<any>({
    scenes: 0,
    cast: 0,
    locations: 0,
    equipment: 0,
    totalCost: 0,
    budgetLimit: 0,
    isFeasible: null
  });
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!projectId) {
      setStats({
        scenes: 0, cast: 0, locations: 0, equipment: 0, totalCost: 0, budgetLimit: 0, isFeasible: null
      });
      return;
    }
    setLoading(true);
    try {
      const [scenes, cast, locations, equipment, budget, schedule] = await Promise.allSettled([
        apiClient.get(`/api/projects/${projectId}/scenes`),
        apiClient.get(`/api/projects/${projectId}/cast`),
        apiClient.get(`/api/projects/${projectId}/locations`),
        apiClient.get(`/api/projects/${projectId}/equipment`),
        apiClient.get(`/api/projects/${projectId}/budget`),
        apiClient.get(`/api/projects/${projectId}/schedule`)
      ]);
      
      setStats({
        scenes: scenes.status === 'fulfilled' && scenes.value ? scenes.value.length : 0,
        cast: cast.status === 'fulfilled' && cast.value ? cast.value.length : 0,
        locations: locations.status === 'fulfilled' && locations.value ? locations.value.length : 0,
        equipment: equipment.status === 'fulfilled' && equipment.value ? equipment.value.length : 0,
        totalCost: schedule.status === 'fulfilled' && schedule.value ? (schedule.value.total_cost || 0) : 0,
        budgetLimit: budget.status === 'fulfilled' && budget.value ? (budget.value.total_limit || 0) : 0,
        isFeasible: schedule.status === 'fulfilled' && schedule.value ? schedule.value.is_feasible : null
      });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const budgetUsage = stats.budgetLimit > 0 ? (stats.totalCost / stats.budgetLimit) * 100 : 0;

  return (
    <AppShell>
      <div className="py-stack-md animate-in fade-in duration-500 flex flex-col min-h-0 h-[calc(100vh-64px)] overflow-hidden">
        
        <div className="flex justify-between items-end pb-4 mb-stack-md border-b border-outline-variant/30 flex-shrink-0">
          <div>
            <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">Analytics & Reports</h1>
            <p className="text-on-surface-variant font-body-md mt-1">High-level insights into your project&apos;s resources and constraints.</p>
          </div>
        </div>

        <ProjectSelector selectedId={projectId} onSelect={handleProjectSelect} />

        {projectId ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-8">
            
            {loading ? (
              <div className="flex justify-center items-center h-48 text-on-surface-variant">Gathering analytics...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Metric Cards */}
                <Card className="bg-surface-container-low border border-outline-variant flex flex-col items-center justify-center p-6 hover:border-primary-container/50 transition-colors">
                  <span className="material-symbols-outlined text-[32px] text-primary-container mb-3">movie_creation</span>
                  <div className="font-mono-data text-[36px] text-on-surface mb-1">{stats.scenes}</div>
                  <div className="font-label-md uppercase tracking-wider text-on-surface-variant">Scenes</div>
                </Card>

                <Card className="bg-surface-container-low border border-outline-variant flex flex-col items-center justify-center p-6 hover:border-accent/50 transition-colors">
                  <span className="material-symbols-outlined text-[32px] text-accent mb-3">groups</span>
                  <div className="font-mono-data text-[36px] text-on-surface mb-1">{stats.cast}</div>
                  <div className="font-label-md uppercase tracking-wider text-on-surface-variant">Cast Members</div>
                </Card>

                <Card className="bg-surface-container-low border border-outline-variant flex flex-col items-center justify-center p-6 hover:border-primary-container/50 transition-colors">
                  <span className="material-symbols-outlined text-[32px] text-primary-container mb-3">pin_drop</span>
                  <div className="font-mono-data text-[36px] text-on-surface mb-1">{stats.locations}</div>
                  <div className="font-label-md uppercase tracking-wider text-on-surface-variant">Locations</div>
                </Card>

                <Card className="bg-surface-container-low border border-outline-variant flex flex-col items-center justify-center p-6 hover:border-accent/50 transition-colors">
                  <span className="material-symbols-outlined text-[32px] text-accent mb-3">camera</span>
                  <div className="font-mono-data text-[36px] text-on-surface mb-1">{stats.equipment}</div>
                  <div className="font-label-md uppercase tracking-wider text-on-surface-variant">Equipment Items</div>
                </Card>

                <Card className="md:col-span-2 lg:col-span-4 bg-surface-container border-primary-container/30 mt-4 flex items-center justify-between p-8">
                  <div>
                    <h3 className="font-label-md uppercase tracking-wider text-primary-container mb-2">Schedule Health</h3>
                    {stats.isFeasible === null ? (
                      <div className="font-headline-md text-on-surface">No schedule generated yet.</div>
                    ) : stats.isFeasible ? (
                      <div className="font-headline-md text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-green-400">check_circle</span>
                        Current schedule is feasible
                      </div>
                    ) : (
                      <div className="font-headline-md text-error flex items-center gap-2">
                        <span className="material-symbols-outlined">warning</span>
                        Schedule contains conflicts
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-label-md uppercase tracking-wider text-on-surface-variant mb-1">Budget Usage</div>
                    <div className="font-mono-data text-[32px] text-on-surface">
                      ${stats.totalCost.toLocaleString()} <span className="text-[16px] text-on-surface-variant">/ ${stats.budgetLimit.toLocaleString()}</span>
                    </div>
                    <div className={`font-label-md mt-1 ${budgetUsage > 100 ? 'text-error' : budgetUsage > 75 ? 'text-accent' : 'text-primary-container'}`}>
                      {budgetUsage.toFixed(1)}% Used
                    </div>
                  </div>
                </Card>

              </div>
            )}

          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-on-surface-variant italic">
            Please select a project to view analytics.
          </div>
        )}
      </div>
    </AppShell>
  );
}
