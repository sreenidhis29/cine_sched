'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { apiClient } from '@/lib/apiClient';

export default function MySchedulePage() {
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/api/me/schedule')
      .then(data => setSchedule(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Group by project, then by shoot date/day
  const grouped = schedule.reduce((acc: any, entry: any) => {
    const projId = entry.project_id;
    const projName = entry.project_name;
    const date = entry.shoot_date || `Day ${entry.shoot_day}`;

    if (!acc[projId]) acc[projId] = { name: projName, days: {} };
    if (!acc[projId].days[date]) acc[projId].days[date] = [];
    acc[projId].days[date].push(entry);
    return acc;
  }, {});

  return (
    <AppShell>
      <div className="py-stack-md animate-in fade-in duration-500 flex flex-col min-h-0 h-[calc(100vh-64px)] overflow-hidden">

        <div className="flex justify-between items-end pb-4 mb-stack-md border-b border-outline-variant/30 flex-shrink-0">
          <div>
            <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface flex items-center gap-3">
              <span className="material-symbols-outlined text-primary-container text-[32px]">calendar_month</span>
              My Call Sheet
            </h1>
            <p className="text-on-surface-variant font-body-md mt-1">Your personalized schedule across all active productions.</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-8">
          {loading ? (
            // Loading skeleton
            <div className="space-y-6 animate-pulse">
              {[0, 1].map(i => (
                <div key={i}>
                  <div className="h-5 w-40 bg-surface-container rounded mb-3" />
                  <Card className="p-0 overflow-hidden bg-surface-container-low border border-outline-variant">
                    <div className="bg-surface-container px-6 py-3 h-11" />
                    {[0, 1].map(j => (
                      <div key={j} className="px-6 py-4 flex gap-6 border-t border-outline-variant/30">
                        <div className="w-24 space-y-2">
                          <div className="h-6 bg-surface-container rounded" />
                          <div className="h-4 bg-surface-container rounded w-16" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="h-5 bg-surface-container rounded w-3/4" />
                          <div className="h-4 bg-surface-container rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </Card>
                </div>
              ))}
            </div>
          ) : schedule.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-16 bg-surface-container-low border-dashed border-2 border-outline-variant/50">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40 mb-4 block">event_busy</span>
              <h2 className="font-headline-md text-on-surface">No Call Times Scheduled</h2>
              <p className="font-body-md text-on-surface-variant mt-2 max-w-md text-center">
                You haven't been scheduled for any upcoming scenes yet. If you believe this is an error, contact your production office — your account may need to be linked to your cast record.
              </p>
            </Card>
          ) : (
            <div className="space-y-8">
              {Object.values(grouped).map((proj: any) => (
                <div key={proj.name} className="space-y-4">
                  <h2 className="font-headline-md text-[20px] text-primary-container border-b border-outline-variant/30 pb-2">{proj.name}</h2>

                  {Object.entries(proj.days).map(([date, entries]: [string, any]) => (
                    <Card key={date} className="p-0 overflow-hidden bg-surface-container-low border border-outline-variant shadow-lg">
                      <div className="bg-surface-container px-6 py-3 border-b border-outline-variant flex items-center gap-3">
                        <span className="material-symbols-outlined text-on-surface-variant">event</span>
                        <h3 className="font-bold text-on-surface">{date}</h3>
                      </div>
                      <div className="divide-y divide-outline-variant/30">
                        {entries.map((scene: any, i: number) => (
                          <div key={i} className="px-6 py-4 flex gap-6 hover:bg-surface-container-low/50 transition-colors">
                            {/* Time column */}
                            <div className="w-24 text-right flex-shrink-0">
                              <div className="font-mono-data text-[18px] text-on-surface">
                                {scene.start_time ? scene.start_time.substring(0, 5) : 'TBD'}
                              </div>
                              {scene.end_time && (
                                <div className="font-label-md text-on-surface-variant mt-1">
                                  until {scene.end_time.substring(0, 5)}
                                </div>
                              )}
                            </div>

                            {/* Scene info */}
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <span className="font-label-md bg-surface-variant px-2 py-0.5 rounded text-[11px] uppercase tracking-wider">
                                  Scene {scene.scene_number}
                                </span>
                                <h4 className="font-bold text-on-surface text-[16px]">{scene.scene_title}</h4>
                              </div>

                              {/* Cast role indicator */}
                              {scene.cast_role && (
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="material-symbols-outlined text-[14px] text-primary-container">theater_comedy</span>
                                  <span className="text-xs text-primary-container font-medium">Playing: {scene.cast_role}</span>
                                </div>
                              )}

                              <div className="flex items-center gap-6 mt-2 text-on-surface-variant">
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-[16px]">location_on</span>
                                  <span className="font-label-md">{scene.location_name}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
