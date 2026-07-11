'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { ProjectSelector } from '@/components/ui/ProjectSelector';
import { Card } from '@/components/ui/Card';
import { apiClient } from '@/lib/apiClient';

export default function ReportsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('projectId') || '';
  const [projectId, setProjectId] = useState<string>(initialProjectId);

  const handleProjectSelect = (id: string) => {
    setProjectId(id);
    router.replace(`${pathname}?projectId=${id}`);
  };
  
  const [scenes, setScenes] = useState<any[]>([]);
  const [cast, setCast] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [scenesRes, castRes, locationsRes, scheduleRes] = await Promise.allSettled([
        apiClient.get(`/api/projects/${projectId}/scenes`),
        apiClient.get(`/api/projects/${projectId}/cast`),
        apiClient.get(`/api/projects/${projectId}/locations`),
        apiClient.get(`/api/projects/${projectId}/schedule`)
      ]);

      if (scenesRes.status === 'fulfilled' && scenesRes.value) setScenes(scenesRes.value);
      if (castRes.status === 'fulfilled' && castRes.value) setCast(castRes.value);
      if (locationsRes.status === 'fulfilled' && locationsRes.value) setLocations(locationsRes.value);
      if (scheduleRes.status === 'fulfilled' && scheduleRes.value) setSchedule(scheduleRes.value);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);



  useEffect(() => {
    fetchData();
  }, [projectId, fetchData]);

  // Compute Day-Out-of-Days (DOOD)
  const doodData = React.useMemo((): { list: any[]; maxDay: number } | null => {
    if (!schedule || !schedule.entries || cast.length === 0 || scenes.length === 0) return null;

    // Find max shoot day
    let maxDay = 1;
    schedule.entries.forEach((e: any) => {
      if (e.shoot_day > maxDay) maxDay = e.shoot_day;
    });

    const list: any[] = [];

    cast.forEach((cm: any) => {
      // Find all shoot days for this actor
      const actorDays = new Set<number>();
      schedule.entries.forEach((entry: any) => {
        const scene = scenes.find((s: any) => s.id === entry.scene_id);
        if (scene && scene.cast_members?.some((actor: any) => actor.id === cm.id)) {
          actorDays.add(entry.shoot_day);
        }
      });

      if (actorDays.size === 0) return; // skip cast members not scheduled

      const sortedDays = Array.from(actorDays).sort((a, b) => a - b);
      const firstDay = sortedDays[0];
      const lastDay = sortedDays[sortedDays.length - 1];

      const days: string[] = [];
      for (let day = 1; day <= maxDay; day++) {
        if (actorDays.has(day)) {
          if (day === firstDay) days.push('S'); // Start
          else if (day === lastDay) days.push('F'); // Finish
          else days.push('W'); // Work
        } else {
          if (day > firstDay && day < lastDay) {
            days.push('H'); // Hold
          } else {
            days.push('-'); // Idle / Not yet started or finished
          }
        }
      }

      list.push({
        id: cm.id,
        name: cm.name,
        role: cm.role,
        days: days,
        workDays: sortedDays.length,
        holdDays: days.filter(d => d === 'H').length,
        cost: sortedDays.length * (cm.cost_per_day || 0)
      });
    });

    return { list, maxDay };
  }, [schedule, cast, scenes]);


  // Compute Location shooting calendar
  const locationReport = React.useMemo(() => {
    if (!schedule || !schedule.entries || locations.length === 0 || scenes.length === 0) return [];
    
    return locations.map((loc: any) => {
      const locDays = new Set<number>();
      schedule.entries.forEach((entry: any) => {
        const scene = scenes.find((s: any) => s.id === entry.scene_id);
        if (scene && scene.location_id === loc.id) {
          locDays.add(entry.shoot_day);
        }
      });

      const daysUsed = Array.from(locDays).sort((a, b) => a - b);
      return {
        id: loc.id,
        name: loc.name,
        daysUsed: daysUsed,
        daysCount: daysUsed.length,
        totalCost: daysUsed.length * (loc.cost_per_day || 0)
      };
    }).filter(loc => loc.daysCount > 0);
  }, [schedule, locations, scenes]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppShell>
      <div className="py-stack-md animate-in fade-in duration-500 flex flex-col min-h-0 h-[calc(100vh-64px)] print:h-auto overflow-hidden print:overflow-visible">
        
        {/* Header */}
        <div className="flex justify-between items-end pb-4 mb-stack-md border-b border-outline-variant/30 flex-shrink-0 print:hidden">
          <div>
            <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">Reports</h1>
            <p className="text-on-surface-variant font-body-md mt-1 font-sans">Generate call-sheets, DOODs, and location calendars.</p>
          </div>
          {projectId && (
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 bg-surface-container border border-outline-variant hover:bg-surface-variant/50 active:scale-95 px-4 py-2 rounded font-label-md uppercase tracking-wider font-bold transition-all shadow-md"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              Print Report
            </button>
          )}
        </div>

        {/* Project Selector - Hidden during print */}
        <div className="print:hidden flex-shrink-0 mb-4">
          <ProjectSelector selectedId={projectId} onSelect={handleProjectSelect} />
        </div>

        {projectId ? (
          <div className="flex-1 overflow-y-auto pr-2 pb-8 space-y-6 custom-scrollbar print:overflow-visible print:pr-0 print:pb-0">
            {loading ? (
              <div className="flex justify-center items-center h-48 text-on-surface-variant">Generating report cards...</div>
            ) : !schedule ? (
              <div className="flex justify-center items-center h-48 text-on-surface-variant italic bg-surface-container-low rounded-lg border border-outline-variant/30">
                No active schedule has been calculated for this project yet. Please run the AI Solver first.
              </div>
            ) : (
              <>
                {/* DOOD Report */}
                <Card className="p-6 bg-surface-container-low border border-outline-variant/30">
                  <h3 className="font-headline-md text-[18px] text-on-surface mb-4 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
                    <span className="material-symbols-outlined text-primary-container">calendar_view_month</span>
                    Cast Day-Out-of-Days (DOOD)
                  </h3>
                  <div className="w-full overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="border-b border-outline-variant/50 bg-surface-container">
                          <th className="p-3 text-on-surface-variant font-label-md uppercase text-xs w-[180px]">Cast Member</th>
                          <th className="p-3 text-on-surface-variant font-label-md uppercase text-xs w-[120px]">Role</th>
                          {Array.from({ length: doodData?.maxDay || 0 }).map((_, idx) => (
                            <th key={idx} className="p-2 text-on-surface-variant font-mono-data text-center text-xs">
                              D{idx + 1}
                            </th>
                          ))}
                          <th className="p-2 text-on-surface-variant font-label-md uppercase text-center text-xs w-[60px]">Work</th>
                          <th className="p-2 text-on-surface-variant font-label-md uppercase text-center text-xs w-[60px]">Hold</th>
                          <th className="p-2 text-on-surface-variant font-label-md uppercase text-right text-xs w-[100px]">Est Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/20 font-body-md text-sm">
                        {doodData?.list?.map((row: any) => (
                          <tr key={row.id} className="hover:bg-surface-variant/20 transition-colors">
                            <td className="p-3 font-bold text-on-surface">{row.name}</td>
                            <td className="p-3 text-on-surface-variant">{row.role}</td>
                            {row.days.map((dayStatus: string, idx: number) => {
                              let cellClass = "bg-transparent text-on-surface-variant/40";
                              if (dayStatus === 'S') cellClass = "bg-green-600 text-white font-bold rounded shadow-sm";
                              if (dayStatus === 'F') cellClass = "bg-red-600 text-white font-bold rounded shadow-sm";
                              if (dayStatus === 'W') cellClass = "bg-primary-container/20 text-primary-container font-bold rounded";
                              if (dayStatus === 'H') cellClass = "bg-amber-600/20 text-amber-500 font-bold rounded";
                              
                              return (
                                <td key={idx} className="p-1 text-center font-mono-data text-xs">
                                  <span className={`inline-block w-6 h-6 leading-6 text-center ${cellClass}`}>
                                    {dayStatus}
                                  </span>
                                </td>
                              );
                            })}
                            <td className="p-2 text-center font-mono-data">{row.workDays}</td>
                            <td className="p-2 text-center font-mono-data">{row.holdDays}</td>
                            <td className="p-2 text-right font-mono-data text-on-surface font-semibold">${row.cost.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex gap-4 text-xs text-on-surface-variant italic border-t border-outline-variant/10 pt-3">
                    <span className="flex items-center gap-1"><span className="w-3.5 h-3.5 rounded bg-green-600 inline-block"></span> S = Start</span>
                    <span className="flex items-center gap-1"><span className="w-3.5 h-3.5 rounded bg-primary-container/20 inline-block border border-primary-container/30"></span> W = Work</span>
                    <span className="flex items-center gap-1"><span className="w-3.5 h-3.5 rounded bg-amber-600/20 inline-block border border-amber-500/20"></span> H = Hold (Paid idle day)</span>
                    <span className="flex items-center gap-1"><span className="w-3.5 h-3.5 rounded bg-red-600 inline-block"></span> F = Finish</span>
                  </div>
                </Card>

                {/* Location Usage Calendar */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="p-6 bg-surface-container-low border border-outline-variant/30">
                    <h3 className="font-headline-md text-[18px] text-on-surface mb-4 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
                      <span className="material-symbols-outlined text-primary-container">pin_drop</span>
                      Location Shooting Days
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-outline-variant/50 bg-surface-container text-xs">
                            <th className="p-3 text-on-surface-variant font-label-md uppercase">Location</th>
                            <th className="p-3 text-on-surface-variant font-label-md uppercase">Shoot Days</th>
                            <th className="p-3 text-on-surface-variant font-label-md uppercase text-center">Days</th>
                            <th className="p-3 text-on-surface-variant font-label-md uppercase text-right">Total Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/20 font-body-md text-sm">
                          {locationReport.map((loc: any) => (
                            <tr key={loc.id} className="hover:bg-surface-variant/20 transition-colors">
                              <td className="p-3 font-bold text-on-surface">{loc.name}</td>
                              <td className="p-3">
                                <div className="flex gap-1.5 flex-wrap">
                                  {loc.daysUsed.map((dayNum: number) => (
                                    <span key={dayNum} className="px-2 py-0.5 rounded text-xs bg-primary-container/20 text-primary-container font-mono-data border border-primary-container/10">
                                      Day {dayNum}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="p-3 text-center font-mono-data">{loc.daysCount}</td>
                              <td className="p-3 text-right font-mono-data text-on-surface font-semibold">${loc.totalCost.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {/* Summary Costs Breakdown Card */}
                  <Card className="p-6 bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
                    <div>
                      <h3 className="font-headline-md text-[18px] text-on-surface mb-4 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
                        <span className="material-symbols-outlined text-primary-container">analytics</span>
                        Financial Analytics Summary
                      </h3>
                      <div className="space-y-4 font-body-md text-sm mt-3">
                        <div className="flex justify-between items-center py-2 border-b border-outline-variant/10">
                          <span className="text-on-surface-variant">Estimated Cast Cost</span>
                          <span className="font-mono-data font-semibold text-on-surface">
                            ${doodData?.list?.reduce((acc: number, row: any) => acc + row.cost, 0).toLocaleString() ?? '0'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-outline-variant/10">
                          <span className="text-on-surface-variant">Estimated Location Cost</span>
                          <span className="font-mono-data font-semibold text-on-surface">
                            ${locationReport.reduce((acc, row) => acc + row.totalCost, 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-outline-variant/10">
                          <span className="text-on-surface-variant">Estimated Equipment Cost (Placeholder)</span>
                          <span className="font-mono-data font-semibold text-on-surface">$0</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-outline-variant/20 bg-surface-container-high/20 px-2 rounded mt-2">
                          <span className="font-bold text-on-surface">Estimated Total Budget Burn</span>
                          <span className="font-mono-data font-bold text-primary-container text-lg">
                            ${schedule.total_cost?.toLocaleString() || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-surface-container-high/40 rounded border border-outline-variant/30 text-xs text-on-surface-variant mt-4 leading-relaxed font-sans italic">
                      Disclaimer: These cost estimations are based entirely on scheduling continuity, active actor day-rates, and location daily lease rates populated in constraints data.
                    </div>
                  </Card>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-on-surface-variant italic">
            Please select a project to load reports.
          </div>
        )}
      </div>
    </AppShell>
  );
}
