'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/apiClient';
import { AgentActivityPanel } from '@/components/ui/AgentActivityPanel';
import Loader from '@/components/ui/Loader';

const shootSteps = [
  "Fetching Open-Meteo forecasts...",
  "Scoring suitability per location/day...",
  "Ranking top recommended dates...",
  "Done."
];

export default function ShootWindowPlanPage() {
  const { id: projectId } = useParams();
  const router = useRouter();

  const [planResult, setPlanResult] = useState<any>(null);
  const [projectLocations, setProjectLocations] = useState<any[]>([]);
  const [projectScenes, setProjectScenes] = useState<any[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(true);

  // Modal configuration states for Recompute
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [dateRangeDays, setDateRangeDays] = useState<number>(16);
  const [planningShoot, setPlanningShoot] = useState(false);

  // Active hover day for custom details box
  const [hoveredDay, setHoveredDay] = useState<any>(null);
  const [hoveredLocName, setHoveredLocName] = useState<string>('');

  const [loadingRuns, setLoadingRuns] = useState(true);

  const handleRecompute = async () => {
    setPlanningShoot(true);
    try {
      const res = await apiClient.post(`/api/projects/${projectId}/shoot-window-plan`, {
        location_ids: selectedLocationIds.length > 0 ? selectedLocationIds : undefined,
        date_range_days: dateRangeDays
      });
      sessionStorage.setItem(`last_shoot_window_result_${projectId}`, JSON.stringify(res));
      setPlanResult(res);
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Failed to recompute shoot windows. Please try again.');
    } finally {
      setPlanningShoot(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoadingRuns(true);
      try {
        const run = await apiClient.get(`/api/projects/${projectId}/planner-runs?plan_type=shoot_window`);
        if (run && run.result_json) {
          setPlanResult(run.result_json);
          if (run.result_json.locations && run.result_json.locations.length > 0) {
            setDateRangeDays(run.result_json.locations[0].day_scores.length);
          }
          if (run.config_json && run.config_json.location_ids) {
            setSelectedLocationIds(run.config_json.location_ids);
          }
        } else {
          const stored = sessionStorage.getItem(`last_shoot_window_result_${projectId}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            setPlanResult(parsed);
            if (parsed.locations && parsed.locations.length > 0) {
              setDateRangeDays(parsed.locations[0].day_scores.length);
            }
          }
        }
      } catch (e) {
        console.error('Error fetching latest shoot window plan:', e);
      } finally {
        setLoadingRuns(false);
      }

      try {
        const [locs, scns] = await Promise.all([
          apiClient.get(`/api/projects/${projectId}/locations`),
          apiClient.get(`/api/projects/${projectId}/scenes`)
        ]);
        setProjectLocations(locs || []);
        setProjectScenes(scns || []);
        
        const extIds = (locs || []).filter((loc: any) => 
          (scns || []).some((s: any) => s.location_id === loc.id && s.setting && s.setting.toUpperCase().includes('EXT'))
        ).map((l: any) => l.id);
        setSelectedLocationIds(prev => prev.length > 0 ? prev : extIds);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingMetadata(false);
      }
    };

    if (projectId) {
      loadData();
    }
  }, [projectId]);

  if (loadingRuns || loadingMetadata) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <Loader />
          <span className="text-on-surface-variant font-medium mt-4">Loading Shoot Planner...</span>
        </div>
      </AppShell>
    );
  }

  if (!planResult) {
    return (
      <AppShell>
        <div className="py-stack-md flex flex-col min-h-0 h-[calc(100vh-64px)] justify-center items-center text-center px-6">
          <div className="w-16 h-16 rounded-full bg-primary-container/10 flex items-center justify-center border border-primary-container/20 mb-4">
            <span className="material-symbols-outlined text-primary-container text-[32px]">calendar_month</span>
          </div>
          <h2 className="font-headline-md text-[18px] text-on-surface font-bold mb-2">No Saved Shoot-Window Plan</h2>
          <p className="text-on-surface-variant font-body-md max-w-md mb-6">
            Plan and optimize shooting windows for your exterior locations. Running the planner evaluates weather conditions like precipitation and wind comfort over a 16-day forecast.
          </p>
          <button 
            onClick={() => setModalOpen(true)}
            className="px-6 py-2.5 bg-primary-container text-on-primary-fixed font-bold font-label-md uppercase rounded hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            Run Shoot Planner
          </button>

          <Modal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Configure Weather Shoot-Window Planner"
            sidePanel={<AgentActivityPanel isActive={planningShoot} steps={shootSteps} />}
            footer={
              <>
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 font-label-md uppercase hover:bg-surface-variant rounded transition-colors text-on-surface-variant">Cancel</button>
                <button onClick={handleRecompute} disabled={planningShoot} className="px-4 py-2 bg-primary-container text-on-primary-fixed-variant font-bold font-label-md uppercase rounded hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5">
                  {planningShoot ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">bolt</span>
                      Run Planner
                    </>
                  )}
                </button>
              </>
            }
          >
            <div className="space-y-6 py-2 text-left">
              <div>
                <label className="block text-xs font-label-md uppercase tracking-wider text-on-surface-variant mb-2">Select Locations to Analyze</label>
                <div className="max-h-[200px] overflow-y-auto border border-outline-variant/30 rounded-lg p-3 bg-surface-container space-y-2.5 custom-scrollbar">
                  {projectLocations.filter(l => l.latitude !== null && l.longitude !== null).map(loc => {
                    const isExt = projectScenes.some(s => s.location_id === loc.id && s.setting && s.setting.toUpperCase().includes('EXT'));
                    return (
                      <label key={loc.id} className="flex items-center gap-3 cursor-pointer text-sm text-on-surface">
                        <input
                          type="checkbox"
                          checked={selectedLocationIds.includes(loc.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLocationIds([...selectedLocationIds, loc.id]);
                            } else {
                              setSelectedLocationIds(selectedLocationIds.filter(id => id !== loc.id));
                            }
                          }}
                          className="rounded text-primary bg-surface-container-high border-outline-variant/50 focus:ring-primary focus:ring-offset-0"
                        />
                        <span className="truncate">{loc.name}</span>
                        {isExt && (
                          <span className="text-[9px] bg-primary-container/20 text-primary-container border border-primary-container/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">EXT</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-label-md uppercase tracking-wider text-on-surface-variant mb-2">Forecast Horizon (Days)</label>
                <Input 
                  type="number" 
                  min={1} 
                  max={16} 
                  value={dateRangeDays} 
                  onChange={(e) => setDateRangeDays(Math.min(16, Math.max(1, parseInt(e.target.value) || 16)))} 
                />
                <p className="text-[11px] text-on-surface-variant italic mt-1.5">
                  Maximum forecast horizon for daily weather metrics is 16 days.
                </p>
              </div>
            </div>
          </Modal>
        </div>
      </AppShell>
    );
  }

  // Helper to format date label
  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = d.getDate();
    return { dayName, dayNum };
  };

  // Helper to determine heat map cell color
  const getCellColorClass = (score: number) => {
    if (score >= 85) return 'bg-amber-500 text-[#131313] border-amber-400/30';
    if (score >= 70) return 'bg-amber-600/60 text-on-surface border-amber-600/20';
    if (score >= 50) return 'bg-amber-700/30 text-on-surface-variant border-amber-700/10';
    return 'bg-rose-950/30 text-on-surface-variant border-rose-900/20';
  };

  // Get list of dates from the first location series
  const datesList = planResult.locations.length > 0 
    ? planResult.locations[0].day_scores.map((d: any) => d.date)
    : [];

  return (
    <AppShell>
      <div className="py-stack-md animate-in fade-in duration-500 flex flex-col min-h-0 h-[calc(100vh-64px)] overflow-hidden">
        
        {/* Header Section */}
        <div className="flex justify-between items-center pb-4 mb-stack-md border-b border-outline-variant/30 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-container">calendar_month</span>
              <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">Weather Shoot-Window Planner</h1>
            </div>
            <p className="text-on-surface-variant font-body-md mt-1">
              Find the most suitable dates to shoot at your exterior locations based on real forecast metrics.
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => router.push(`/locations?projectId=${projectId}`)}
              className="flex items-center gap-2 border border-outline-variant text-on-surface hover:bg-surface-variant/40 px-3 py-2 rounded font-label-md uppercase tracking-wider transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to Locations
            </button>
            <button 
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 bg-primary-container text-on-primary-fixed font-bold hover:brightness-110 active:scale-95 px-3 py-2 rounded font-label-md uppercase tracking-wider transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">settings</span>
              Configure / Recompute
            </button>
          </div>
        </div>

        {/* Outer scrollable container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-8 space-y-6 min-h-0">
          
          {/* Calendar Heatmap Section */}
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 shadow-lg">
            <h2 className="font-headline-sm text-headline-sm text-primary-container font-bold mb-4 uppercase tracking-wider">
              Suitability Calendar Heatmap
            </h2>
            
            <div className="overflow-x-auto custom-scrollbar pb-2">
              <div className="min-w-[800px] select-none">
                {/* Heatmap Grid Header */}
                <div className="flex border-b border-outline-variant/20 pb-2 mb-2">
                  <div className="w-[180px] flex-shrink-0 text-xs font-label-md uppercase tracking-wider text-on-surface-variant flex items-end">
                    Location
                  </div>
                  <div className="flex-1 flex justify-between gap-1">
                    {datesList.map((dateStr: string) => {
                      const { dayName, dayNum } = formatDateLabel(dateStr);
                      return (
                        <div key={dateStr} className="flex-1 text-center min-w-[40px]">
                          <p className="text-[10px] text-on-surface-variant/70 font-semibold">{dayName}</p>
                          <p className="text-xs font-bold text-on-surface">{dayNum}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Heatmap Grid Rows */}
                <div className="space-y-1.5">
                  {planResult.locations.map((loc: any) => (
                    <div key={loc.location_id} className="flex items-center">
                      <div className="w-[180px] flex-shrink-0 text-sm font-bold text-on-surface truncate pr-3" title={loc.name}>
                        {loc.name}
                      </div>
                      <div className="flex-1 flex justify-between gap-1">
                        {loc.day_scores.map((day: any) => (
                          <div
                            key={day.date}
                            onMouseEnter={() => {
                              setHoveredDay(day);
                              setHoveredLocName(loc.name);
                            }}
                            className={`flex-1 aspect-square rounded cursor-pointer border flex flex-col items-center justify-center transition-all hover:scale-105 hover:shadow-md ${getCellColorClass(day.score)}`}
                          >
                            <span className="text-[10px] font-bold font-mono-data">
                              {Math.round(day.score)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Heatmap Legend */}
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-outline-variant/10 text-xs text-on-surface-variant">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-amber-500 border border-amber-400/20" /> Excellent (85-100)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-amber-600/60 border border-amber-600/20" /> Good (70-84)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-amber-700/30 border border-amber-700/10" /> Moderate (50-69)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-rose-950/30 border border-rose-900/20" /> Poor (0-49)
                </span>
              </div>
              <span className="italic">Hover cells to view specific weather metrics</span>
            </div>
          </div>

          {/* Hover Day Detail Widget */}
          {hoveredDay && (
            <div className="bg-surface-container border border-primary-container/20 rounded-xl p-4 shadow-lg animate-in slide-in-from-top-2 duration-300">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-xs font-label-md text-primary-container uppercase tracking-wider">Focused Day Metrics</span>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface mt-0.5">
                    {hoveredLocName} — {new Date(hoveredDay.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </h3>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-on-surface-variant font-label-md uppercase tracking-wider">Suitability</span>
                  <span className="font-mono-data text-2xl font-extrabold text-primary-container">{hoveredDay.score}%</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-surface-container-low border border-outline-variant/20 rounded-lg p-2.5">
                  <p className="text-[10px] text-on-surface-variant uppercase font-label-md">Rain Probability</p>
                  <p className="font-mono-data font-bold text-sm text-on-surface mt-1">{hoveredDay.precip_prob}%</p>
                </div>
                <div className="bg-surface-container-low border border-outline-variant/20 rounded-lg p-2.5">
                  <p className="text-[10px] text-on-surface-variant uppercase font-label-md">Precipitation Volume</p>
                  <p className="font-mono-data font-bold text-sm text-on-surface mt-1">{hoveredDay.precip_mm} mm</p>
                </div>
                <div className="bg-surface-container-low border border-outline-variant/20 rounded-lg p-2.5">
                  <p className="text-[10px] text-on-surface-variant uppercase font-label-md">Max Wind Speed</p>
                  <p className="font-mono-data font-bold text-sm text-on-surface mt-1">{hoveredDay.wind_kmh} km/h</p>
                </div>
                <div className="bg-surface-container-low border border-outline-variant/20 rounded-lg p-2.5">
                  <p className="text-[10px] text-on-surface-variant uppercase font-label-md">Comfort Temperature</p>
                  <p className="font-mono-data font-bold text-sm text-on-surface mt-1">{hoveredDay.temp_c}°C</p>
                </div>
              </div>
            </div>
          )}

          {/* Location Recommendation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {planResult.locations.map((loc: any) => (
              <Card key={loc.location_id} className="bg-surface-container-low border-outline-variant/30 p-5 shadow-lg">
                <div className="flex justify-between items-center border-b border-outline-variant/20 pb-3 mb-4">
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface truncate pr-2">
                    {loc.name}
                  </h3>
                  <span className="text-[9px] bg-primary-container/20 text-primary-container border border-primary-container/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                    Top Recommendations
                  </span>
                </div>

                <div className="space-y-3">
                  {loc.recommended_dates.map((rec: any, idx: number) => {
                    const formattedDate = new Date(rec.date).toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric'
                    });

                    return (
                      <div key={rec.date} className="flex items-center gap-3 bg-surface-container/40 p-3 rounded-lg border border-outline-variant/10 hover:border-primary-container/20 transition-all">
                        <div className="w-7 h-7 rounded-full bg-primary-container text-on-primary-fixed-variant flex items-center justify-center font-bold text-xs">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-on-surface">{formattedDate}</p>
                          <p className="text-xs text-on-surface-variant italic mt-0.5 truncate" title={rec.reason}>
                            {rec.reason}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-on-surface-variant font-semibold">Suitability</p>
                          <p className="font-mono-data font-bold text-sm text-primary">{Math.round(rec.score)}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>

        </div>

        {/* Modal for Recompute */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Configure Weather Shoot-Window Planner"
          sidePanel={<AgentActivityPanel isActive={planningShoot} steps={shootSteps} />}
          footer={
            <>
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 font-label-md uppercase hover:bg-surface-variant rounded transition-colors text-on-surface-variant">Cancel</button>
              <button onClick={handleRecompute} disabled={planningShoot} className="px-4 py-2 bg-primary-container text-on-primary-fixed-variant font-bold font-label-md uppercase rounded hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5">
                {planningShoot ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">bolt</span>
                    Recompute
                  </>
                )}
              </button>
            </>
          }
        >
          <div className="space-y-6 py-2">
            <div>
              <label className="block text-xs font-label-md uppercase tracking-wider text-on-surface-variant mb-2">Select Locations to Analyze</label>
              <div className="max-h-[200px] overflow-y-auto border border-outline-variant/30 rounded-lg p-3 bg-surface-container space-y-2.5 custom-scrollbar">
                {projectLocations.filter(l => l.latitude !== null && l.longitude !== null).map(loc => {
                  const isExt = projectScenes.some(s => s.location_id === loc.id && s.setting && s.setting.toUpperCase().includes('EXT'));
                  return (
                    <label key={loc.id} className="flex items-center gap-3 cursor-pointer text-sm text-on-surface">
                      <input
                        type="checkbox"
                        checked={selectedLocationIds.includes(loc.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLocationIds([...selectedLocationIds, loc.id]);
                          } else {
                            setSelectedLocationIds(selectedLocationIds.filter(id => id !== loc.id));
                          }
                        }}
                        className="rounded text-primary bg-surface-container-high border-outline-variant/50 focus:ring-primary focus:ring-offset-0"
                      />
                      <span className="truncate">{loc.name}</span>
                      {isExt && (
                        <span className="text-[9px] bg-primary-container/20 text-primary-container border border-primary-container/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">EXT</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-label-md uppercase tracking-wider text-on-surface-variant mb-2">Forecast Horizon (Days)</label>
              <Input 
                type="number" 
                min={1} 
                max={16} 
                value={dateRangeDays} 
                onChange={(e) => setDateRangeDays(Math.min(16, Math.max(1, parseInt(e.target.value) || 16)))} 
              />
              <p className="text-[11px] text-on-surface-variant italic mt-1.5">
                Maximum forecast horizon for daily weather metrics is 16 days.
              </p>
            </div>
          </div>
        </Modal>

      </div>
    </AppShell>
  );
}
