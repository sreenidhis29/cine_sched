'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { apiClient } from '@/lib/apiClient';
import dynamic from 'next/dynamic';

const RoutePlanMap = dynamic(() => import('@/components/ui/RoutePlanMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-on-surface-variant bg-surface-container-low border border-outline-variant/30 rounded-xl">
      Loading routing map...
    </div>
  )
});

export default function RoutePlanPage() {
  const { id: projectId } = useParams();
  const router = useRouter();

  const [routeResult, setRouteResult] = useState<any>(null);
  const [projectLocations, setProjectLocations] = useState<any[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(true);

  // Recompute Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [tripType, setTripType] = useState<'round_trip' | 'one_way'>('round_trip');
  const [startLocId, setStartLocId] = useState<string>('');
  const [routing, setRouting] = useState(false);

  const handleRecompute = async () => {
    setRouting(true);
    try {
      const res = await apiClient.post(`/api/projects/${projectId}/route-plan`, {
        trip_type: tripType,
        start_location_id: startLocId || undefined
      });
      sessionStorage.setItem('last_route_plan_result', JSON.stringify(res));
      setRouteResult(res);
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Failed to recompute route. Please try again.');
    } finally {
      setRouting(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoadingRuns(true);
      try {
        const run = await apiClient.get(`/api/projects/${projectId}/planner-runs?plan_type=route`);
        if (run && run.result_json) {
          setRouteResult(run.result_json);
          setTripType(run.result_json.trip_type || 'round_trip');
          if (run.config_json && run.config_json.start_location_id) {
            setStartLocId(run.config_json.start_location_id);
          }
        } else {
          const stored = sessionStorage.getItem('last_route_plan_result');
          if (stored) {
            const parsed = JSON.parse(stored);
            setRouteResult(parsed);
            setTripType(parsed.trip_type || 'round_trip');
          }
        }
      } catch (e) {
        console.error('Error fetching latest route plan:', e);
      } finally {
        setLoadingRuns(false);
      }

      try {
        const res = await apiClient.get(`/api/projects/${projectId}/locations`);
        setProjectLocations(res || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingLocations(false);
      }
    };

    if (projectId) {
      loadData();
    }
  }, [projectId]);

  if (loadingRuns || loadingLocations) {
    return (
      <AppShell>
        <div className="p-8 text-center text-on-surface-variant italic font-body-md">
          Loading Route Planner...
        </div>
      </AppShell>
    );
  }

  if (!routeResult) {
    return (
      <AppShell>
        <div className="py-stack-md flex flex-col min-h-0 h-[calc(100vh-64px)] justify-center items-center text-center px-6">
          <div className="w-16 h-16 rounded-full bg-primary-container/10 flex items-center justify-center border border-primary-container/20 mb-4">
            <span className="material-symbols-outlined text-primary-container text-[32px]">route</span>
          </div>
          <h2 className="font-headline-md text-[18px] text-on-surface font-bold mb-2">No Saved Route Plan</h2>
          <p className="text-on-surface-variant font-body-md max-w-md mb-6">
            Optimize your travel routes between shoot locations. Running the planner calculates travel durations, segment maps, and identifies potential overnight stays.
          </p>
          <button 
            onClick={() => setModalOpen(true)}
            className="px-6 py-2.5 bg-primary-container text-on-primary-fixed font-bold font-label-md uppercase rounded hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            Run Route Planner
          </button>

          <Modal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Configure Route Planner"
            footer={
              <>
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 font-label-md uppercase hover:bg-surface-variant rounded transition-colors text-on-surface-variant">Cancel</button>
                <button onClick={handleRecompute} disabled={routing} className="px-4 py-2 bg-primary-container text-on-primary-fixed-variant font-bold font-label-md uppercase rounded hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5">
                  {routing ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                      Optimizing...
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
                <label className="block text-xs font-label-md uppercase tracking-wider text-on-surface-variant mb-2">Trip Type</label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`flex flex-col p-4 rounded-xl border cursor-pointer transition-all ${tripType === 'round_trip' ? 'border-primary-container bg-primary-container/5' : 'border-outline-variant/30 hover:bg-surface-variant/20'}`}>
                    <div className="flex items-center gap-2 font-bold text-sm mb-1 text-on-surface">
                      <input type="radio" checked={tripType === 'round_trip'} onChange={() => setTripType('round_trip')} className="text-primary-container focus:ring-primary-container bg-surface-container" />
                      Round Trip
                    </div>
                    <span className="text-[11px] text-on-surface-variant leading-relaxed">Closed tour: Starts at base, visits all locations, and returns to base.</span>
                  </label>

                  <label className={`flex flex-col p-4 rounded-xl border cursor-pointer transition-all ${tripType === 'one_way' ? 'border-primary-container bg-primary-container/5' : 'border-outline-variant/30 hover:bg-surface-variant/20'}`}>
                    <div className="flex items-center gap-2 font-bold text-sm mb-1 text-on-surface">
                      <input type="radio" checked={tripType === 'one_way'} onChange={() => setTripType('one_way')} className="text-primary-container focus:ring-primary-container bg-surface-container" />
                      One-Way
                    </div>
                    <span className="text-[11px] text-on-surface-variant leading-relaxed">Open path: Starts at base, visits all locations, and ends at the final stop.</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-label-md uppercase tracking-wider text-on-surface-variant mb-2">Start / Base Location</label>
                <select 
                  value={startLocId} 
                  onChange={(e) => setStartLocId(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant/30 text-on-surface rounded px-3 py-2 text-sm focus:outline-none focus:border-primary-container"
                >
                  <option value="">Auto-detected Project Base</option>
                  {projectLocations.filter(l => l.latitude !== null && l.longitude !== null).map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-on-surface-variant italic mt-1.5">
                  If not selected, the planner defaults to the project's primary shoot base.
                </p>
              </div>
            </div>
          </Modal>
        </div>
      </AppShell>
    );
  }

  // Map stop IDs back to coordinates and full names
  const stops = routeResult.ordered_stops.map((id: string) => {
    const loc = projectLocations.find(l => l.id === id);
    return {
      id,
      name: loc?.name || "Unknown Location",
      latitude: loc?.latitude || 0,
      longitude: loc?.longitude || 0,
      cost_per_day: loc?.cost_per_day || 0
    };
  }).filter((stop: any) => stop.latitude !== 0 && stop.longitude !== 0);


  const durationDiff = routeResult.naive_order_total_duration_min - routeResult.total_duration_min;
  const timeSaved = Math.max(0, Math.round(durationDiff));

  return (
    <AppShell>
      <div className="py-stack-md animate-in fade-in duration-500 flex flex-col min-h-0 h-[calc(100vh-64px)] overflow-hidden">
        
        {/* Header Block */}
        <div className="flex justify-between items-center pb-4 mb-stack-md border-b border-outline-variant/30 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-container">route</span>
              <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">Travel Route Plan</h1>
            </div>
            <p className="text-on-surface-variant font-body-md mt-1">
              Optimized sequence for visiting your production locations.
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

        {/* Comparison Banner */}
        {timeSaved > 0 && (
          <div className="mb-4 bg-primary-container/10 border border-primary-container/20 px-4 py-3 rounded-xl flex justify-between items-center flex-shrink-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="material-symbols-outlined text-primary-container">bolt</span>
              <span>
                CineSched optimized routing: <strong>{routeResult.total_duration_min} mins</strong> instead of naive order (<strong>{routeResult.naive_order_total_duration_min} mins</strong>).
              </span>
            </div>
            <span className="bg-primary-container text-on-primary-fixed text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              Saves {timeSaved} mins
            </span>
          </div>
        )}

        {/* Content Split: Map & Details Sidebar */}
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
          
          {/* Main Map View */}
          <div className="flex-1 rounded-xl border border-outline-variant/30 overflow-hidden min-h-[300px] lg:min-h-0 h-full shadow-lg">
            {loadingLocations ? (
              <div className="w-full h-full flex items-center justify-center text-on-surface-variant bg-surface-container-low">
                Loading locations data...
              </div>
            ) : (
              <RoutePlanMap stops={stops} segments={routeResult.segments} />
            )}
          </div>

          {/* Sidebar: Details Panel */}
          <div className="w-full lg:w-[360px] flex-shrink-0 flex flex-col min-h-0 bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 overflow-y-auto custom-scrollbar">
            <h2 className="font-headline-sm text-headline-sm text-primary-container font-bold mb-4 uppercase tracking-wider">
              Route Details ({routeResult.trip_type === 'round_trip' ? 'Round Trip' : 'One Way'})
            </h2>

            {/* Total Metrics Card */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Card className="bg-surface-container p-3 flex flex-col justify-center border-outline-variant/20">
                <span className="text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">Distance</span>
                <span className="font-mono-data text-lg font-bold text-on-surface mt-1">{routeResult.total_distance_km} km</span>
              </Card>
              <Card className="bg-surface-container p-3 flex flex-col justify-center border-outline-variant/20">
                <span className="text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">Duration</span>
                <span className="font-mono-data text-lg font-bold text-primary-container mt-1">{routeResult.total_duration_min} min</span>
              </Card>
            </div>

            {/* Sequence list */}
            <h3 className="font-label-md text-xs text-on-surface-variant uppercase tracking-widest mb-3">Stops Order</h3>
            <div className="space-y-4 flex-1">
              {stops.map((stop: any, idx: number) => {
                const isStart = idx === 0;
                const isEnd = idx === stops.length - 1;

                // Find segment ending at this stop (for duration info)
                const incomingSegment = routeResult.segments.find((seg: any) => seg.to_location_id === stop.id);

                return (
                  <div key={stop.id} className="relative flex gap-3 items-start pl-2">
                    {/* Visual Connector Line */}
                    {!isEnd && (
                      <div className="absolute top-8 bottom-0 left-[18px] w-0.5 bg-outline-variant/30 z-0" />
                    )}

                    {/* Number Pin badge */}
                    <div className="w-6 h-6 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center text-[11px] font-bold text-primary flex-shrink-0 z-10">
                      {idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-1">
                        <p className="font-bold text-sm text-on-surface truncate" title={stop.name}>
                          {stop.name}
                        </p>
                        {isStart && (
                          <span className="text-[9px] bg-primary-container/20 text-primary-container border border-primary-container/30 px-1 rounded uppercase font-bold flex-shrink-0">
                            Start / Base
                          </span>
                        )}
                      </div>
                      
                      {incomingSegment && (
                        <p className="text-[11px] text-on-surface-variant mt-1">
                          ↳ Leg {idx}: <span className="font-mono-data text-on-surface">{incomingSegment.distance_km} km</span> ({incomingSegment.duration_min} mins)
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Show return leg if round trip */}
              {routeResult.trip_type === 'round_trip' && stops.length > 1 && (() => {
                const returnSegment = routeResult.segments[routeResult.segments.length - 1];
                if (returnSegment && returnSegment.to_location_id === stops[0].id) {
                  return (
                    <div className="relative flex gap-3 items-start pl-2">
                      <div className="w-6 h-6 rounded-full bg-surface-container-high border border-primary-container/40 flex items-center justify-center text-[11px] font-bold text-primary flex-shrink-0 z-10">
                        ↩
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-on-surface-variant truncate">
                          Return to Base ({stops[0].name})
                        </p>
                        <p className="text-[11px] text-on-surface-variant mt-1">
                          ↳ Return Leg: <span className="font-mono-data text-on-surface">{returnSegment.distance_km} km</span> ({returnSegment.duration_min} mins)
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

          </div>

        </div>

        {/* Modal for Route Recompute */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Configure Route Optimizer"
          footer={
            <>
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 font-label-md uppercase hover:bg-surface-variant rounded transition-colors text-on-surface-variant">Cancel</button>
              <button onClick={handleRecompute} disabled={routing} className="px-4 py-2 bg-primary-container text-on-primary-fixed-variant font-bold font-label-md uppercase rounded hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5">
                {routing ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    Optimizing...
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
              <label className="block text-xs font-label-md uppercase tracking-wider text-on-surface-variant mb-2">Trip Type</label>
              <div className="grid grid-cols-2 gap-4">
                <label className={`flex flex-col p-4 rounded-xl border cursor-pointer transition-all ${tripType === 'round_trip' ? 'border-primary-container bg-primary-container/5' : 'border-outline-variant/30 hover:bg-surface-variant/20'}`}>
                  <div className="flex items-center gap-2 font-bold text-sm mb-1 text-on-surface">
                    <input type="radio" checked={tripType === 'round_trip'} onChange={() => setTripType('round_trip')} className="text-primary-container focus:ring-primary-container bg-surface-container" />
                    Round Trip
                  </div>
                  <span className="text-[11px] text-on-surface-variant leading-relaxed">Closed tour: Starts at base, visits all locations, and returns to base.</span>
                </label>

                <label className={`flex flex-col p-4 rounded-xl border cursor-pointer transition-all ${tripType === 'one_way' ? 'border-primary-container bg-primary-container/5' : 'border-outline-variant/30 hover:bg-surface-variant/20'}`}>
                  <div className="flex items-center gap-2 font-bold text-sm mb-1 text-on-surface">
                    <input type="radio" checked={tripType === 'one_way'} onChange={() => setTripType('one_way')} className="text-primary-container focus:ring-primary-container bg-surface-container" />
                    One-Way
                  </div>
                  <span className="text-[11px] text-on-surface-variant leading-relaxed">Open path: Starts at base, visits all locations, and ends at the final stop.</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-label-md uppercase tracking-wider text-on-surface-variant mb-2">Start / Base Location</label>
              <select 
                value={startLocId} 
                onChange={(e) => setStartLocId(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant/30 text-on-surface rounded px-3 py-2 text-sm focus:outline-none focus:border-primary-container"
              >
                <option value="">Auto-detected Project Base</option>
                {projectLocations.filter(l => l.latitude !== null && l.longitude !== null).map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          </div>
        </Modal>

      </div>
    </AppShell>
  );
}
