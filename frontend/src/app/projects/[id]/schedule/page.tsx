'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';

export default function ScheduleViewPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [schedule, setSchedule] = useState<any>(null);
  const [scenes, setScenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const baseUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/projects/${projectId}`;

        const [scheduleRes, scenesRes] = await Promise.all([
          fetch(`${baseUrl}/schedule`, { headers }),
          fetch(`${baseUrl}/scenes`, { headers })
        ]);

        if (scheduleRes.ok) setSchedule(await scheduleRes.json());
        if (scenesRes.ok) setScenes(await scenesRes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  // Group entries by day
  const scheduleDays = React.useMemo(() => {
    if (!schedule || !schedule.entries || !scenes) return [];
    const daysMap = new Map();
    
    schedule.entries.forEach((entry: any) => {
      const day = entry.shoot_day;
      if (!daysMap.has(day)) {
        daysMap.set(day, {
          date: `DAY ${day}`, // or shoot_date if available
          scenes: []
        });
      }
      
      const sceneData = scenes.find(s => s.id === entry.scene_id);
      
      daysMap.get(day).scenes.push({
        id: sceneData ? sceneData.scene_number : entry.scene_id,
        type: sceneData ? sceneData.setting : 'UNK',
        title: sceneData ? sceneData.title : 'Unknown Scene',
        time: `${entry.start_time?.substring(0,5) || '??:??'} - ${entry.end_time?.substring(0,5) || '??:??'}`,
        cast: 'Multiple', // Mock for now, would need to fetch cast relations
        status: schedule.violations.some((v: string) => v.includes(entry.scene_id)) ? 'conflict' : 'completed'
      });
    });
    
    return Array.from(daysMap.values()).sort((a, b) => parseInt(a.date.split(' ')[1]) - parseInt(b.date.split(' ')[1]));
  }, [schedule, scenes]);

  const satisfactionScore = schedule?.is_feasible ? 100 : Math.max(0, 100 - (schedule?.violations?.length || 0) * 10);

  return (
    <AppShell>
      <div className="py-stack-md animate-in fade-in duration-500 flex h-[calc(100vh-64px)] overflow-hidden gap-gutter">
        
        {/* Main Schedule Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex justify-between items-end pb-4 mb-stack-md flex-shrink-0">
            <div>
              <div className="flex items-center gap-2 text-on-surface-variant font-label-md uppercase tracking-wider mb-2">
                <Link href="/projects" className="hover:text-primary-container transition-colors">Projects</Link>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                <Link href={`/projects/${projectId}`} className="hover:text-primary-container transition-colors">Project</Link>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                <span>Master Schedule</span>
              </div>
              <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">Master Schedule</h1>
            </div>
            <div className="flex gap-3">
              <Link href={`/projects/${projectId}/trace`} className="flex items-center gap-2 border border-primary-container text-primary-container hover:bg-primary-container/10 px-4 py-2 rounded font-label-md uppercase tracking-wider font-bold transition-all">
                <span className="material-symbols-outlined text-[18px]">psychology</span>
                View Reasoning Trace
              </Link>
              <button className="flex items-center gap-2 border border-outline-variant text-on-surface hover:bg-surface-variant/50 px-4 py-2 rounded font-label-md uppercase tracking-wider font-bold transition-all">
                <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                Export
              </button>
            </div>
          </div>

          {/* Timeline Grid */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-stack-lg custom-scrollbar">
            {loading ? (
               <div className="flex justify-center items-center h-full text-on-surface-variant">Loading schedule...</div>
            ) : scheduleDays.length === 0 ? (
               <div className="flex justify-center items-center h-full text-on-surface-variant">No schedule found. Try running the scheduler.</div>
            ) : (
              scheduleDays.map((day, i) => (
                <div key={i}>
                  <h3 className="font-label-md text-[14px] uppercase tracking-wider text-on-surface-variant border-b border-outline-variant/30 pb-2 mb-4 sticky top-0 bg-background/90 backdrop-blur-sm z-10">
                    {day.date}
                  </h3>
                  <div className="space-y-unit">
                    {day.scenes.map((scene: any, j: number) => (
                      <div 
                        key={j} 
                        className="bg-surface-container-low border border-outline-variant rounded flex items-stretch hover:border-primary-container/50 transition-colors shadow-sm"
                      >
                        {/* Left Accent Bar */}
                        <div className={`w-1.5 rounded-l ${scene.type && scene.type.includes('EXT') ? 'bg-primary-container' : 'bg-accent'}`} />
                        
                        <div className="p-3 flex-1 flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <div className="font-mono-data text-mono-data text-on-surface bg-surface-container px-2 py-1 rounded">
                              {scene.time}
                            </div>
                            <div>
                              <span className="font-headline-md text-[14px] font-bold text-on-surface">{scene.id} - {scene.title}</span>
                              <div className="font-label-md text-[11px] text-on-surface-variant uppercase mt-1">
                                {scene.type}
                              </div>
                            </div>
                          </div>
                          
                          {scene.status === 'conflict' && (
                            <div className="flex items-center gap-1 text-error">
                              <span className="material-symbols-outlined text-[18px]">warning</span>
                              <span className="font-label-md text-[11px] uppercase tracking-wider">Conflict</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side Panel */}
        <div className="w-[320px] flex-shrink-0 flex flex-col gap-gutter overflow-y-auto custom-scrollbar pb-8">
          
          {/* Financial Status Panel */}
          {schedule && (
            <Card className="flex-shrink-0">
              <h3 className="font-label-md uppercase tracking-wider text-on-surface-variant mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                Financial Status
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[11px] font-label-md uppercase tracking-wider text-on-surface-variant mb-1">
                    <span>Burn Rate</span>
                    <span className="text-primary-container">{schedule.total_cost ? Math.min(100, (schedule.total_cost / 150000) * 100).toFixed(0) : 0}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-bright rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary-container rounded-full" 
                      style={{ width: `${schedule.total_cost ? Math.min(100, (schedule.total_cost / 150000) * 100) : 0}%` }} 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-outline-variant/30">
                  <div>
                    <div className="font-label-md text-[10px] text-on-surface-variant uppercase mb-1">Estimated Cost</div>
                    <div className="font-mono-data text-on-surface text-[14px]">${schedule.total_cost || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="font-label-md text-[10px] text-on-surface-variant uppercase mb-1">Budget Cap</div>
                    <div className="font-mono-data text-on-surface-variant text-[14px]">$150,000</div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* AI Analysis Card */}
          {schedule && (
            <Card className="flex-shrink-0 bg-surface-container-high border-primary-container/30">
              <h3 className="font-label-md uppercase tracking-wider text-primary-container mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">psychology</span>
                CineFlow AI Analysis
              </h3>
              <div className="space-y-3 font-body-md text-[13px] text-on-surface leading-relaxed">
                <p>
                  The current schedule achieves <strong className="text-white">{satisfactionScore}% constraint satisfaction</strong>.
                </p>
                {schedule.violations?.map((v: string, i: number) => (
                  <div key={i} className="bg-error-container/20 border border-error-container p-3 rounded text-error-container text-xs">
                    <div className="font-bold flex items-center gap-1 mb-1">
                      <span className="material-symbols-outlined text-[16px]">warning</span> Conflict Detected
                    </div>
                    {v}
                  </div>
                ))}
                {schedule.relaxations?.map((r: string, i: number) => (
                  <div key={i} className="bg-surface-bright border border-outline-variant p-3 rounded text-on-surface-variant text-xs">
                    <div className="font-bold flex items-center gap-1 mb-1">
                      <span className="material-symbols-outlined text-[16px]">info</span> Relaxation Made
                    </div>
                    {r}
                  </div>
                ))}
                {schedule.explanation && (
                  <p className="text-on-surface-variant mt-2 border-t border-outline-variant/30 pt-2 text-xs italic">
                    {schedule.explanation}
                  </p>
                )}
              </div>
            </Card>
          )}

        </div>
      </div>
    </AppShell>
  );
}
