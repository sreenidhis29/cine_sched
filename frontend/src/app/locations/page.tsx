'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { ProjectSelector } from '@/components/ui/ProjectSelector';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { apiClient } from '@/lib/apiClient';
import dynamic from 'next/dynamic';

const LocationMapView = dynamic(() => import('@/components/ui/LocationMapView'), {
  ssr: false,
  loading: () => (
    <div className="h-[500px] flex items-center justify-center text-on-surface-variant bg-surface-container-low border border-outline-variant/30 rounded-xl">
      Loading map view...
    </div>
  )
});

function LocationsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('projectId') || '';
  const [projectId, setProjectId] = useState<string>(initialProjectId);

  const handleProjectSelect = (id: string) => {
    setProjectId(id);
    router.replace(`${pathname}?projectId=${id}`);
  };
  const [data, setData] = useState<any[]>([]);
  const [scenes, setScenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  
  // CRUD State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Route Planner State
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [tripType, setTripType] = useState<'round_trip' | 'one_way'>('round_trip');
  const [startLocId, setStartLocId] = useState<string>('');
  const [routing, setRouting] = useState(false);

  // Shoot Window State
  const [shootModalOpen, setShootModalOpen] = useState(false);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [dateRangeDays, setDateRangeDays] = useState<number>(16);
  const [planningShoot, setPlanningShoot] = useState(false);

  // Budget Planner State
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [crewHourlyRate, setCrewHourlyRate] = useState<number>(500);
  const [includeRoutePlan, setIncludeRoutePlan] = useState<boolean>(true);
  const [includeShootPlan, setIncludeShootPlan] = useState<boolean>(true);
  const [planningBudget, setPlanningBudget] = useState(false);

  const fetchData = useCallback(async () => {
    if (!projectId) {
      setData([]);
      setScenes([]);
      return;
    }
    setLoading(true);
    try {
      const [locsRes, scenesRes] = await Promise.all([
        apiClient.get(`/api/projects/${projectId}/locations`),
        apiClient.get(`/api/projects/${projectId}/scenes`)
      ]);
      setData(locsRes || []);
      setScenes(scenesRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData(item);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({});
    setModalOpen(true);
  };

  const handleDelete = async (item: any) => {
    if (!confirm('Are you sure you want to delete this location?')) return;
    try {
      await apiClient.delete(`/api/projects/${projectId}/locations/${item.id}`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const endpoint = `/api/projects/${projectId}/locations`;
      if (editingItem) {
        await apiClient.patch(`${endpoint}/${editingItem.id}`, formData);
      } else {
        await apiClient.post(endpoint, formData);
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleRunRoutePlanner = async () => {
    setRouting(true);
    try {
      const res = await apiClient.post(`/api/projects/${projectId}/route-plan`, {
        trip_type: tripType,
        start_location_id: startLocId || undefined
      });
      sessionStorage.setItem(`last_route_plan_result_${projectId}`, JSON.stringify(res));
      setRouteModalOpen(false);
      router.push(`/projects/${projectId}/route-plan`);
    } catch (err) {
      console.error(err);
      alert('Failed to calculate optimized route. Please try again.');
    } finally {
      setRouting(false);
    }
  };

  const handleOpenShootPlanner = () => {
    const extIds = data.filter(loc => 
      scenes.some(s => s.location_id === loc.id && s.setting && s.setting.toUpperCase().includes('EXT'))
    ).map(l => l.id);
    setSelectedLocationIds(extIds);
    setShootModalOpen(true);
  };

  const handleRunShootPlanner = async () => {
    setPlanningShoot(true);
    try {
      const res = await apiClient.post(`/api/projects/${projectId}/shoot-window-plan`, {
        location_ids: selectedLocationIds.length > 0 ? selectedLocationIds : undefined,
        date_range_days: dateRangeDays
      });
      sessionStorage.setItem(`last_shoot_window_result_${projectId}`, JSON.stringify(res));
      setShootModalOpen(false);
      router.push(`/projects/${projectId}/shoot-window-plan`);
    } catch (err) {
      console.error(err);
      alert('Failed to calculate shoot windows. Please try again.');
    } finally {
      setPlanningShoot(false);
    }
  };

  const handleRunBudgetPlanner = async () => {
    setPlanningBudget(true);
    try {
      const storedRoute = sessionStorage.getItem(`last_route_plan_result_${projectId}`);
      const storedShoot = sessionStorage.getItem(`last_shoot_window_result_${projectId}`);
      
      const payload: any = {
        crew_hourly_rate: crewHourlyRate
      };
      
      if (includeRoutePlan && storedRoute) {
        payload.route_plan = JSON.parse(storedRoute);
      }
      if (includeShootPlan && storedShoot) {
        payload.shoot_window_plan = JSON.parse(storedShoot);
      }
      
      const res = await apiClient.post(`/api/projects/${projectId}/budget-plan`, payload);
      sessionStorage.setItem(`last_budget_plan_result_${projectId}`, JSON.stringify(res));
      setBudgetModalOpen(false);
      router.push(`/projects/${projectId}/budget-plan`);
    } catch (err) {
      console.error(err);
      alert('Failed to calculate budget plan. Please try again.');
    } finally {
      setPlanningBudget(false);
    }
  };

  const columns = [
    { header: 'Name', accessorKey: 'name' },
    { 
      header: 'Latitude', 
      accessorKey: 'latitude',
      isNumeric: true,
      cell: (row: any) => row.latitude !== null && row.latitude !== undefined ? row.latitude.toFixed(6) : '-'
    },
    { 
      header: 'Longitude', 
      accessorKey: 'longitude',
      isNumeric: true,
      cell: (row: any) => row.longitude !== null && row.longitude !== undefined ? row.longitude.toFixed(6) : '-'
    },
    { header: 'Cost/Day', accessorKey: 'cost_per_day', isNumeric: true },
    {
      header: 'Actions',
      accessorKey: 'actions',
      align: 'right' as const,
      cell: (row: any) => (
        <div className="flex justify-end gap-2 text-on-surface-variant">
          <button onClick={() => handleEdit(row)} className="p-1 hover:text-primary-container transition-colors"><span className="material-symbols-outlined text-[18px]">edit</span></button>
          <button onClick={() => handleDelete(row)} className="p-1 hover:text-error transition-colors"><span className="material-symbols-outlined text-[18px]">delete</span></button>
        </div>
      )
    }
  ];

  return (
    <AppShell>
      <div className="py-stack-md animate-in fade-in duration-500 flex flex-col min-h-0 h-[calc(100vh-64px)] overflow-hidden">
        
        <div className="flex justify-between items-end pb-4 mb-stack-md border-b border-outline-variant/30 flex-shrink-0">
          <div>
            <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">Location Manager</h1>
            <p className="text-on-surface-variant font-body-md mt-1">Manage shooting locations and associated costs.</p>
          </div>
        </div>

        <ProjectSelector selectedId={projectId} onSelect={handleProjectSelect} />

        {projectId ? (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Content Controls (Sticky at the top, does not scroll) */}
            <div className="flex justify-between items-center mb-stack-md flex-shrink-0">
              <div className="flex gap-4 items-center flex-1 mr-4">
                <div className="w-1/3 max-w-xs">
                  <Input icon="search" placeholder="Search locations..." className="py-2 text-sm" />
                </div>
                
                {/* View Mode Toggle */}
                <div className="flex bg-surface-container rounded-lg p-0.5 border border-outline-variant/30">
                  <button 
                    onClick={() => setViewMode('table')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-label-md text-xs uppercase tracking-wider transition-all ${viewMode === 'table' ? 'bg-primary-container text-on-primary-fixed font-bold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">table_chart</span>
                    Table
                  </button>
                  <button 
                    onClick={() => setViewMode('map')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-label-md text-xs uppercase tracking-wider transition-all ${viewMode === 'map' ? 'bg-primary-container text-on-primary-fixed font-bold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">map</span>
                    Map
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={handleAdd} className="flex items-center gap-2 border border-outline-variant text-on-surface hover:bg-primary-container hover:text-on-primary-fixed-variant px-3 py-2 rounded font-label-md uppercase tracking-wider transition-all">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Add Location
                </button>
                <button className="flex items-center gap-2 border border-outline-variant text-on-surface hover:bg-surface-variant/50 px-3 py-2 rounded font-label-md uppercase tracking-wider transition-all">
                  <span className="material-symbols-outlined text-[18px]">filter_list</span>
                  Filters
                </button>
              </div>
            </div>

            {/* Scrollable Content Body (Table or Map) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-8">
              {viewMode === 'table' ? (
                <div className="bg-surface-container-low rounded-lg border border-outline-variant shadow-xl overflow-hidden min-h-[300px]">
                  {loading ? (
                    <div className="flex justify-center items-center h-full min-h-[300px] text-on-surface-variant">Loading locations...</div>
                  ) : (
                    <DataTable data={data} columns={columns} />
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {loading ? (
                    <div className="h-[500px] flex items-center justify-center text-on-surface-variant bg-surface-container-low border border-outline-variant/30 rounded-xl">
                      Loading map view...
                    </div>
                  ) : (
                    <LocationMapView locations={data} />
                  )}
                  
                  {/* Ungeocoded Warning Note */}
                  {(() => {
                    const ungeocodedCount = data.filter(loc => loc.latitude === null || loc.longitude === null || loc.latitude === undefined || loc.longitude === undefined).length;
                    if (ungeocodedCount > 0) {
                      return (
                        <div className="flex items-center gap-2 text-xs text-on-surface-variant italic font-body-md mt-2">
                          <span className="material-symbols-outlined text-[16px] text-primary-container">info</span>
                          <span>{ungeocodedCount} location(s) not yet geocoded — use the table to add coordinates</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>

            {/* Modal for Add/Edit */}
            <Modal 
              isOpen={modalOpen} 
              onClose={() => setModalOpen(false)} 
              title={`${editingItem ? 'Edit' : 'Add'} Location`}
              footer={
                <>
                  <button onClick={() => setModalOpen(false)} className="px-4 py-2 font-label-md uppercase hover:bg-surface-variant rounded transition-colors text-on-surface-variant">Cancel</button>
                  <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary-container text-on-primary-fixed-variant font-bold font-label-md uppercase rounded hover:brightness-110 active:scale-95 transition-all">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </>
              }
            >
              <form className="space-y-4" onSubmit={handleSave}>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input label="Name / Address" value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                  </div>
                  <button 
                    type="button" 
                    onClick={async () => {
                      if (!formData.name) return;
                      try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(formData.name)}&format=json&limit=1`, {
                          headers: {
                            'User-Agent': 'CineSched/1.0'
                          }
                        });
                        const data = await res.json();
                        if (data && data.length > 0) {
                          setFormData({
                            ...formData,
                            latitude: parseFloat(data[0].lat),
                            longitude: parseFloat(data[0].lon)
                          });
                          alert(`Found coordinates: ${data[0].lat}, ${data[0].lon}`);
                        } else {
                          alert('Address not found.');
                        }
                      } catch (e) {
                        alert('Error fetching coordinates.');
                      }
                    }}
                    className="h-[42px] px-3 bg-surface-variant hover:bg-surface-variant/80 text-on-surface rounded border border-outline-variant transition-colors flex items-center gap-1 font-label-md text-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">travel_explore</span>
                    Geocode
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Latitude (Optional)" type="number" step="any" value={formData.latitude || ''} onChange={(e) => setFormData({...formData, latitude: parseFloat(e.target.value)})} />
                  <Input label="Longitude (Optional)" type="number" step="any" value={formData.longitude || ''} onChange={(e) => setFormData({...formData, longitude: parseFloat(e.target.value)})} />
                </div>
                <Input label="Cost Per Day" type="number" value={formData.cost_per_day || ''} onChange={(e) => setFormData({...formData, cost_per_day: parseFloat(e.target.value)})} />
              </form>
            </Modal>

            {/* Modal for Route Planner */}
            <Modal
              isOpen={routeModalOpen}
              onClose={() => setRouteModalOpen(false)}
              title="Configure Travel Route Planner"
              footer={
                <>
                  <button onClick={() => setRouteModalOpen(false)} className="px-4 py-2 font-label-md uppercase hover:bg-surface-variant rounded transition-colors text-on-surface-variant">Cancel</button>
                  <button onClick={handleRunRoutePlanner} disabled={routing} className="px-4 py-2 bg-primary-container text-on-primary-fixed-variant font-bold font-label-md uppercase rounded hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5">
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
                    {data.filter(l => l.latitude !== null && l.longitude !== null).map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-on-surface-variant italic mt-1.5">
                    If not selected, the planner defaults to the project's primary shoot base.
                  </p>
                </div>
              </div>
            </Modal>

            {/* Modal for Shoot-Window Planner */}
            <Modal
              isOpen={shootModalOpen}
              onClose={() => setShootModalOpen(false)}
              title="Configure Weather Shoot-Window Planner"
              footer={
                <>
                  <button onClick={() => setShootModalOpen(false)} className="px-4 py-2 font-label-md uppercase hover:bg-surface-variant rounded transition-colors text-on-surface-variant">Cancel</button>
                  <button onClick={handleRunShootPlanner} disabled={planningShoot} className="px-4 py-2 bg-primary-container text-on-primary-fixed-variant font-bold font-label-md uppercase rounded hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5">
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
              <div className="space-y-6 py-2">
                <div>
                  <label className="block text-xs font-label-md uppercase tracking-wider text-on-surface-variant mb-2">Select Locations to Analyze</label>
                  <div className="max-h-[200px] overflow-y-auto border border-outline-variant/30 rounded-lg p-3 bg-surface-container space-y-2.5 custom-scrollbar">
                    {data.filter(l => l.latitude !== null && l.longitude !== null).map(loc => {
                      const isExt = scenes.some(s => s.location_id === loc.id && s.setting && s.setting.toUpperCase().includes('EXT'));
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

            {/* Modal for Budget Planner */}
            <Modal
              isOpen={budgetModalOpen}
              onClose={() => setBudgetModalOpen(false)}
              title="Configure Budget Planner"
              footer={
                <>
                  <button onClick={() => setBudgetModalOpen(false)} className="px-4 py-2 font-label-md uppercase hover:bg-surface-variant rounded transition-colors text-on-surface-variant">Cancel</button>
                  <button onClick={handleRunBudgetPlanner} disabled={planningBudget} className="px-4 py-2 bg-primary-container text-on-primary-fixed-variant font-bold font-label-md uppercase rounded hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5">
                    {planningBudget ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                        Calculating...
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
              <div className="space-y-6 py-2">
                
                {/* Route Plan Check */}
                <div className="border border-outline-variant/30 rounded-xl p-3 bg-surface-container/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-[18px]">route</span>
                      Route Planner Integration
                    </span>
                    {typeof window !== 'undefined' && sessionStorage.getItem(`last_route_plan_result_${projectId}`) ? (
                      <span className="text-[10px] bg-primary-container/20 text-primary-container border border-primary-container/30 px-1.5 py-0.5 rounded font-bold uppercase">Ready</span>
                    ) : (
                      <span className="text-[10px] bg-rose-950/30 text-rose-300 border border-rose-900/30 px-1.5 py-0.5 rounded font-bold uppercase">Not Run Yet</span>
                    )}
                  </div>
                  
                  {typeof window !== 'undefined' && sessionStorage.getItem(`last_route_plan_result_${projectId}`) ? (
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-on-surface-variant">
                      <input 
                        type="checkbox" 
                        checked={includeRoutePlan} 
                        onChange={(e) => setIncludeRoutePlan(e.target.checked)} 
                        className="rounded text-primary focus:ring-primary focus:ring-offset-0 bg-surface-container-high border-outline-variant/50"
                      />
                      Include last Route Plan (uses optimized travel times & overnight accommodation checks)
                    </label>
                  ) : (
                    <p className="text-[11px] text-on-surface-variant italic">
                      Will use naive straight-line travel estimates. Run the Route Planner first for a precise breakdown.
                    </p>
                  )}
                </div>

                {/* Shoot Window Check */}
                <div className="border border-outline-variant/30 rounded-xl p-3 bg-surface-container/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-[18px]">calendar_month</span>
                      Weather Shoot-Window Integration
                    </span>
                    {typeof window !== 'undefined' && sessionStorage.getItem(`last_shoot_window_result_${projectId}`) ? (
                      <span className="text-[10px] bg-primary-container/20 text-primary-container border border-primary-container/30 px-1.5 py-0.5 rounded font-bold uppercase">Ready</span>
                    ) : (
                      <span className="text-[10px] bg-rose-950/30 text-rose-300 border border-rose-900/30 px-1.5 py-0.5 rounded font-bold uppercase">Not Run Yet</span>
                    )}
                  </div>

                  {typeof window !== 'undefined' && sessionStorage.getItem(`last_shoot_window_result_${projectId}`) ? (
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-on-surface-variant">
                      <input 
                        type="checkbox" 
                        checked={includeShootPlan} 
                        onChange={(e) => setIncludeShootPlan(e.target.checked)} 
                        className="rounded text-primary focus:ring-primary focus:ring-offset-0 bg-surface-container-high border-outline-variant/50"
                      />
                      Include last Shoot-Window Plan (allocates shooting dates per location)
                    </label>
                  ) : (
                    <p className="text-[11px] text-on-surface-variant italic">
                      Will assume 1 shoot day per location. Run the Shoot Planner first to load recommended schedule dates.
                    </p>
                  )}
                </div>

                {/* Crew Hourly Rate Input */}
                <div>
                  <label className="block text-xs font-label-md uppercase tracking-wider text-on-surface-variant mb-2">Crew Hourly Rate ($/hr)</label>
                  <Input 
                    type="number" 
                    min={0}
                    value={crewHourlyRate} 
                    onChange={(e) => setCrewHourlyRate(Math.max(0, parseFloat(e.target.value) || 0))} 
                  />
                  <p className="text-[11px] text-on-surface-variant italic mt-1.5">
                    Used to calculate crew travel cost: (driving hours) × (hourly rate).
                  </p>
                </div>

              </div>
            </Modal>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-on-surface-variant italic">
            Please select a project to view locations.
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function LocationsPage() {
  return (
    <React.Suspense fallback={
      <AppShell>
        <div className="p-8 text-center text-on-surface-variant italic font-body-md">
          Loading Location Manager...
        </div>
      </AppShell>
    }>
      <LocationsPageContent />
    </React.Suspense>
  );
}
