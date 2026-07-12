'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { DataTable } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { apiClient } from '@/lib/apiClient';

export default function ProjectEditorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [activeTab, setActiveTab] = useState('Scenes');
  const [project, setProject] = useState<any>(null);
  const [scenes, setScenes] = useState<any[]>([]);
  const [cast, setCast] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  // CRUD State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [settingFilter, setSettingFilter] = useState('ALL');
  const [costFilter, setCostFilter] = useState('ALL');
  const [qtyFilter, setQtyFilter] = useState('ALL');

  // Geocoding State
  const [geocodeResults, setGeocodeResults] = useState<any[]>([]);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeQueryStr, setGeocodeQueryStr] = useState('');

  const handleGeocodeSearch = async () => {
    if (!geocodeQueryStr.trim()) return;
    setGeocoding(true);
    setGeocodeResults([]);
    try {
      const results = await apiClient.get(`/api/projects/${projectId}/locations/geocode?q=${encodeURIComponent(geocodeQueryStr)}`);
      setGeocodeResults(results || []);
    } catch (e) {
      console.error("Geocoding failed:", e);
    } finally {
      setGeocoding(false);
    }
  };

  const getSingularTab = () => {
    if (activeTab === 'Scenes') return 'Scene';
    if (activeTab === 'Cast') return 'Cast Member';
    if (activeTab === 'Locations') return 'Location';
    if (activeTab === 'Equipment') return 'Equipment';
    return activeTab;
  };

  const fetchData = async () => {
    try {
      const [projRes, scenesRes, castRes, locsRes, equipRes] = await Promise.all([
        apiClient.get(`/api/projects/${projectId}`),
        apiClient.get(`/api/projects/${projectId}/scenes`),
        apiClient.get(`/api/projects/${projectId}/cast`),
        apiClient.get(`/api/projects/${projectId}/locations`),
        apiClient.get(`/api/projects/${projectId}/equipment`),
      ]);

      if (projRes) setProject(projRes);
      if (scenesRes) setScenes(scenesRes);
      if (castRes) setCast(castRes);
      if (locsRes) setLocations(locsRes);
      if (equipRes) setEquipment(equipRes);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  useEffect(() => {
    const handleOpenAddScene = () => {
      setActiveTab('Scenes');
      setEditingItem(null);
      setFormData({ cast_member_ids: [], equipment_ids: [] });
      setModalOpen(true);
    };

    window.addEventListener('open-add-scene', handleOpenAddScene);

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('addScene') === 'true') {
      window.history.replaceState(null, '', window.location.pathname);
      handleOpenAddScene();
    }

    return () => window.removeEventListener('open-add-scene', handleOpenAddScene);
  }, [scenes, cast, locations, equipment]);

  const handleRunScheduler = async () => {
    setRunning(true);
    window.dispatchEvent(new CustomEvent('new-notification', { 
      detail: { title: 'Solver Started', message: `Recalculating optimal shoot schedule for ${project?.name || 'project'}.` } 
    }));
    try {
      const data = await apiClient.post(`/api/projects/${projectId}/run`, {
        start_date: new Date().toISOString().split('T')[0],
        relaxed_constraints: []
      });
      if (data && data.run_id) {
        window.dispatchEvent(new CustomEvent('new-notification', { 
          detail: { title: 'Solver Finished', message: `Successfully generated new schedule run.` } 
        }));
        router.push(`/projects/${projectId}/trace?run_id=${data.run_id}`);
      } else {
        console.error('Failed to run scheduler: missing run_id in response');
        setRunning(false);
      }
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('new-notification', { 
        detail: { title: 'Solver Failed', message: `Error running CP-SAT optimizer: ${err instanceof Error ? err.message : String(err)}` } 
      }));
      setRunning(false);
    }
  };

  const tabs = ['Scenes', 'Cast', 'Locations', 'Equipment'];

  const handleEdit = (item: any) => {
    setEditingItem(item);
    if (activeTab === 'Scenes') {
      setFormData({
        ...item,
        cast_member_ids: item.cast_members?.map((cm: any) => cm.id) || [],
        equipment_ids: item.equipment_items?.map((eq: any) => eq.id) || []
      });
    } else {
      setFormData(item);
    }
    if (activeTab === 'Locations') {
      setGeocodeQueryStr(item.address || item.name || '');
      setGeocodeResults([]);
    }
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData(activeTab === 'Scenes' ? { cast_member_ids: [], equipment_ids: [] } : {});
    if (activeTab === 'Locations') {
      setGeocodeQueryStr('');
      setGeocodeResults([]);
    }
    setModalOpen(true);
  };

  const handleDelete = async (item: any) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await apiClient.delete(`/api/projects/${projectId}/${activeTab.toLowerCase()}/${item.id}`);
      window.dispatchEvent(new CustomEvent('new-notification', { 
        detail: { title: `${getSingularTab()} Deleted`, message: `Successfully removed "${item.name || item.title || 'item'}" from ${activeTab.toLowerCase()}.` } 
      }));
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const endpoint = `/api/projects/${projectId}/${activeTab.toLowerCase()}`;
      if (editingItem) {
        await apiClient.patch(`${endpoint}/${editingItem.id}`, formData);
        window.dispatchEvent(new CustomEvent('new-notification', { 
          detail: { title: `${getSingularTab()} Updated`, message: `Successfully updated "${formData.name || formData.title || 'item'}" in ${activeTab.toLowerCase()}.` } 
        }));
      } else {
        await apiClient.post(endpoint, formData);
        window.dispatchEvent(new CustomEvent('new-notification', { 
          detail: { title: `${getSingularTab()} Created`, message: `Successfully added "${formData.name || formData.title || 'item'}" to ${activeTab.toLowerCase()}.` } 
        }));
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const getColumns = () => {
    const actions = {
      header: 'Actions',
      accessorKey: 'actions',
      align: 'right' as const,
      cell: (row: any) => (
        <div className="flex justify-end gap-2 text-on-surface-variant">
          <button onClick={() => handleEdit(row)} className="p-1 hover:text-primary-container transition-colors"><span className="material-symbols-outlined text-[18px]">edit</span></button>
          <button onClick={() => handleDelete(row)} className="p-1 hover:text-error transition-colors"><span className="material-symbols-outlined text-[18px]">delete</span></button>
        </div>
      )
    };

    if (activeTab === 'Scenes') {
      return [
        { header: 'Scene', accessorKey: 'scene_number', align: 'center' as const },
        { header: 'Title', accessorKey: 'title' },
        { header: 'Setting', accessorKey: 'setting' },
        { header: 'Duration (min)', accessorKey: 'duration_minutes', isNumeric: true },
        {
          header: 'Cast / Actors',
          accessorKey: 'cast_members',
          cell: (row: any) => (
            <div className="flex flex-wrap gap-1 max-w-[250px]">
              {row.cast_members && row.cast_members.length > 0 ? (
                row.cast_members.map((cm: any) => (
                  <span key={cm.id} className="px-2 py-0.5 rounded text-[11px] bg-primary-container/20 text-primary-container border border-primary-container/30">
                    {cm.name}
                  </span>
                ))
              ) : (
                <span className="text-on-surface-variant/50 text-[12px] italic">None</span>
              )}
            </div>
          )
        },
        actions
      ];
    }
    if (activeTab === 'Cast') {
      return [
        { header: 'Name', accessorKey: 'name' },
        { header: 'Role', accessorKey: 'role' },
        { 
          header: 'Scene Nos', 
          accessorKey: 'scenes',
          cell: (row: any) => {
            const sceneNos = scenes
              .filter((s: any) => s.cast_members?.some((cm: any) => cm.id === row.id))
              .map((s: any) => s.scene_number)
              .sort((a, b) => a - b);
            return (
              <div className="flex flex-wrap gap-1 max-w-[200px]">
                {sceneNos.length > 0 ? (
                  sceneNos.map((num) => (
                    <span key={num} className="px-1.5 py-0.5 rounded font-mono-data text-[11px] bg-secondary-container/20 text-accent border border-accent/20">
                      #{num}
                    </span>
                  ))
                ) : (
                  <span className="text-on-surface-variant/50 text-[12px] italic">None</span>
                )}
              </div>
            );
          }
        },
        { header: 'Cost/Day', accessorKey: 'cost_per_day', isNumeric: true },
        actions
      ];
    }
    if (activeTab === 'Locations') {
      return [
        { header: 'Name', accessorKey: 'name' },
        { header: 'Address', accessorKey: 'address', cell: (row: any) => row.address || <span className="text-on-surface-variant/40 italic">Not Geocoded</span> },
        { header: 'Coordinates', cell: (row: any) => row.latitude !== null && row.longitude !== null ? `${row.latitude.toFixed(4)}, ${row.longitude.toFixed(4)}` : <span className="text-on-surface-variant/40 italic">None</span> },
        { header: 'Cost/Day', accessorKey: 'cost_per_day', isNumeric: true },
        actions
      ];
    }
    if (activeTab === 'Equipment') {
      return [
        { header: 'Name', accessorKey: 'name' },
        { header: 'Quantity', accessorKey: 'quantity', isNumeric: true },
        { header: 'Cost/Day', accessorKey: 'cost_per_day', isNumeric: true },
        actions
      ];
    }
    return [];
  };

  const getData = () => {
    let list = [];
    if (activeTab === 'Scenes') {
      list = scenes;
      if (settingFilter !== 'ALL') {
        list = list.filter((s: any) => s.setting?.toUpperCase().includes(settingFilter));
      }
    } else if (activeTab === 'Cast') {
      list = cast;
      if (costFilter !== 'ALL') {
        list = list.filter((c: any) => costFilter === 'HIGH' ? (c.cost_per_day >= 1000) : (c.cost_per_day < 1000));
      }
    } else if (activeTab === 'Locations') {
      list = locations;
    } else if (activeTab === 'Equipment') {
      list = equipment;
      if (qtyFilter !== 'ALL') {
        list = list.filter((e: any) => qtyFilter === 'HIGH' ? (e.quantity >= 5) : (e.quantity < 5));
      }
    }
    
    if (!searchQuery.trim()) return list;
    
    const query = searchQuery.toLowerCase();
    return list.filter((item: any) => {
      return (
        (item.title && item.title.toLowerCase().includes(query)) ||
        (item.name && item.name.toLowerCase().includes(query)) ||
        (item.setting && item.setting.toLowerCase().includes(query)) ||
        (item.role && item.role.toLowerCase().includes(query)) ||
        (item.location_name && item.location_name.toLowerCase().includes(query))
      );
    });
  };

  return (
    <AppShell>
      <div className="py-stack-md animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex justify-between items-end border-b border-outline-variant/30 pb-4 mb-stack-md">
          <div>
            <div className="flex items-center gap-2 text-on-surface-variant font-label-md uppercase tracking-wider mb-2">
              <Link href="/projects" className="hover:text-primary-container transition-colors">Projects</Link>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span>{project?.name || 'Loading...'}</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">Constraints Editor</h1>
          </div>
          <div className="flex gap-3">
            <Link 
              href={`/projects/${projectId}/schedule`}
              className="flex items-center gap-2 border border-outline-variant text-on-surface hover:bg-surface-variant/50 active:bg-surface-variant px-4 py-2 rounded font-label-md uppercase tracking-wider font-bold transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">visibility</span>
              View Schedule
            </Link>
            <button 
              onClick={handleRunScheduler}
              disabled={running}
              className={`flex items-center gap-2 px-4 py-2 rounded font-label-md uppercase tracking-wider font-bold shadow-lg transition-all ${
                running ? 'bg-primary-container/80 text-on-primary-fixed-variant cursor-wait' : 'bg-primary-container text-on-primary-fixed-variant hover:brightness-110 active:scale-[0.99]'
              }`}
            >
              <span className={`material-symbols-outlined text-[18px] ${running ? 'animate-spin' : ''}`}>
                {running ? 'sync' : 'play_arrow'}
              </span>
              Run Scheduler
            </button>
          </div>
        </div>

        {/* Sub-nav */}
        <div className="flex gap-8 border-b border-outline-variant/30 mb-stack-md overflow-x-auto custom-scrollbar">
          {tabs.map((tab, i) => (
            <button 
              key={i} 
              onClick={() => {
                setActiveTab(tab);
                setSearchQuery('');
                setSettingFilter('ALL');
                setCostFilter('ALL');
                setQtyFilter('ALL');
              }}
              className={`pb-3 font-label-md uppercase tracking-wider transition-colors relative whitespace-nowrap ${
                activeTab === tab ? 'text-primary-container' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-container shadow-[0_-2px_8px_rgba(255,184,0,0.5)]" />
              )}
            </button>
          ))}
        </div>

        {/* Content Controls */}
        <div className="flex justify-between items-center mb-stack-md">
          <div className="w-1/3">
            <Input 
              icon="search" 
              placeholder={`Search ${activeTab.toLowerCase()}...`} 
              className="py-2 text-sm" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <button onClick={handleAdd} className="flex items-center gap-2 border border-outline-variant text-on-surface hover:bg-primary-container hover:text-on-primary-fixed-variant px-3 py-2 rounded font-label-md uppercase tracking-wider transition-all">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add {getSingularTab()}
            </button>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 border border-outline-variant px-3 py-2 rounded font-label-md uppercase tracking-wider transition-all ${
                showFilters ? 'bg-primary-container text-on-primary-fixed-variant border-primary-container' : 'text-on-surface hover:bg-surface-variant/50'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">filter_list</span>
              Filters
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-4 mb-stack-md flex gap-4 items-center animate-in slide-in-from-top-2 duration-200">
            {activeTab === 'Scenes' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-on-surface-variant uppercase">Setting:</span>
                <select 
                  value={settingFilter} 
                  onChange={(e) => setSettingFilter(e.target.value)}
                  className="bg-surface-container border border-outline-variant text-on-surface text-xs rounded px-2.5 py-1 focus:outline-none focus:border-primary-container"
                >
                  <option value="ALL">All Settings</option>
                  <option value="INT">INT (Interior)</option>
                  <option value="EXT">EXT (Exterior)</option>
                </select>
              </div>
            )}
            {activeTab === 'Cast' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-on-surface-variant uppercase">Daily Cost:</span>
                <select 
                  value={costFilter} 
                  onChange={(e) => setCostFilter(e.target.value)}
                  className="bg-surface-container border border-outline-variant text-on-surface text-xs rounded px-2.5 py-1 focus:outline-none focus:border-primary-container"
                >
                  <option value="ALL">All Costs</option>
                  <option value="HIGH">High (&gt;= $1,000)</option>
                  <option value="LOW">Low (&lt; $1,000)</option>
                </select>
              </div>
            )}
            {activeTab === 'Equipment' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-on-surface-variant uppercase">Quantity:</span>
                <select 
                  value={qtyFilter} 
                  onChange={(e) => setQtyFilter(e.target.value)}
                  className="bg-surface-container border border-outline-variant text-on-surface text-xs rounded px-2.5 py-1 focus:outline-none focus:border-primary-container"
                >
                  <option value="ALL">All Quantities</option>
                  <option value="HIGH">High Qty (&gt;= 5)</option>
                  <option value="LOW">Low Qty (&lt; 5)</option>
                </select>
              </div>
            )}
            <button 
              onClick={() => {
                setSettingFilter('ALL');
                setCostFilter('ALL');
                setQtyFilter('ALL');
              }}
              className="text-xs text-primary-container hover:underline ml-auto font-bold"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Data Table */}
        <div className="bg-surface-container-low rounded-lg border border-outline-variant shadow-xl overflow-hidden min-h-[300px]">
          {loading ? (
            <div className="flex justify-center items-center h-full min-h-[300px] text-on-surface-variant">Loading {activeTab}...</div>
          ) : (
            <DataTable data={getData()} columns={getColumns()} />
          )}
        </div>

        {/* Modal for Add/Edit */}
        <Modal 
          isOpen={modalOpen} 
          onClose={() => setModalOpen(false)} 
          title={`${editingItem ? 'Edit' : 'Add'} ${activeTab.slice(0, -1)}`}
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
            {activeTab === 'Scenes' && (
              <>
                <Input label="Scene Number" type="number" value={formData.scene_number || ''} onChange={(e) => setFormData({...formData, scene_number: parseInt(e.target.value)})} required />
                <Input label="Title" value={formData.title || ''} onChange={(e) => setFormData({...formData, title: e.target.value})} required />
                <Input label="Setting (e.g. INT, EXT)" value={formData.setting || ''} onChange={(e) => setFormData({...formData, setting: e.target.value})} />
                <Input label="Duration (minutes)" type="number" value={formData.duration_minutes || ''} onChange={(e) => setFormData({...formData, duration_minutes: parseInt(e.target.value)})} />
                
                {/* Select Cast Members */}
                <div className="flex flex-col gap-2">
                  <label className="text-[12px] font-label-md uppercase tracking-wider text-on-surface-variant">Cast Members</label>
                  <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto border border-outline-variant/30 rounded p-2 bg-surface-container-low">
                    {cast.map((c) => {
                      const isSelected = formData.cast_member_ids?.includes(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-2 text-[13px] text-on-surface cursor-pointer hover:bg-surface-variant/30 p-1 rounded">
                          <input 
                            type="checkbox" 
                            checked={!!isSelected}
                            onChange={(e) => {
                              const currentIds = formData.cast_member_ids || [];
                              if (e.target.checked) {
                                setFormData({...formData, cast_member_ids: [...currentIds, c.id]});
                              } else {
                                setFormData({...formData, cast_member_ids: currentIds.filter((id: string) => id !== c.id)});
                              }
                            }}
                          />
                          {c.name} ({c.role})
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Select Equipment */}
                <div className="flex flex-col gap-2">
                  <label className="text-[12px] font-label-md uppercase tracking-wider text-on-surface-variant">Equipment Required</label>
                  <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto border border-outline-variant/30 rounded p-2 bg-surface-container-low">
                    {equipment.map((eq) => {
                      const isSelected = formData.equipment_ids?.includes(eq.id);
                      return (
                        <label key={eq.id} className="flex items-center gap-2 text-[13px] text-on-surface cursor-pointer hover:bg-surface-variant/30 p-1 rounded">
                          <input 
                            type="checkbox" 
                            checked={!!isSelected}
                            onChange={(e) => {
                              const currentIds = formData.equipment_ids || [];
                              if (e.target.checked) {
                                setFormData({...formData, equipment_ids: [...currentIds, eq.id]});
                              } else {
                                setFormData({...formData, equipment_ids: currentIds.filter((id: string) => id !== eq.id)});
                              }
                            }}
                          />
                          {eq.name} (Qty: {eq.quantity})
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
            {activeTab === 'Cast' && (
              <>
                <Input label="Name" value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                <Input label="Role" value={formData.role || ''} onChange={(e) => setFormData({...formData, role: e.target.value})} required />
                <Input label="Linked Email (Optional)" type="email" placeholder="Connect to User Account" value={formData.linked_email || ''} onChange={(e) => setFormData({...formData, linked_email: e.target.value})} />
                <Input label="Cost Per Day" type="number" value={formData.cost_per_day || ''} onChange={(e) => setFormData({...formData, cost_per_day: parseFloat(e.target.value)})} />
              </>
            )}
            {activeTab === 'Locations' && (
              <>
                <Input label="Location Name (e.g. Studio A, Coffee Shop)" value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                <Input label="Cost Per Day ($)" type="number" value={formData.cost_per_day || ''} onChange={(e) => setFormData({...formData, cost_per_day: parseFloat(e.target.value)})} />
                
                <div className="border border-outline-variant/30 rounded p-3 bg-surface-container/20 mt-4 space-y-3">
                  <div className="text-xs font-bold text-primary-container uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">location_on</span>
                    Geocoding & Address (OSM Nominatim)
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Search for a real-world address to automatically retrieve coordinates. Coordinates are required for weather risk and travel distance evaluations.
                  </p>
                  
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Search address (e.g. Times Square, NY)"
                        value={geocodeQueryStr}
                        onChange={(e) => setGeocodeQueryStr(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleGeocodeSearch();
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleGeocodeSearch}
                      disabled={geocoding || !geocodeQueryStr.trim()}
                      className="px-3.5 bg-secondary-container hover:bg-secondary-container/80 text-accent font-bold text-xs uppercase tracking-wider rounded border border-accent/20 flex items-center gap-1 transition-colors self-end h-[36px]"
                    >
                      {geocoding ? (
                        <>
                          <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                          Searching
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[16px]">search</span>
                          Search
                        </>
                      )}
                    </button>
                  </div>

                  {geocodeResults.length > 0 && (
                    <div className="max-h-[160px] overflow-y-auto border border-outline-variant/30 rounded bg-background/50 divide-y divide-outline-variant/30 custom-scrollbar">
                      {geocodeResults.map((r, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              address: r.address,
                              latitude: r.lat,
                              longitude: r.lon,
                            });
                            setGeocodeResults([]);
                          }}
                          className="w-full text-left p-2 hover:bg-surface-variant/30 transition-colors flex flex-col gap-0.5 text-xs text-on-surface-variant"
                        >
                          <span className="font-bold text-on-surface text-[12px]">{r.name}</span>
                          <span className="text-[11px] opacity-80 truncate">{r.address}</span>
                          <span className="text-[10px] opacity-50 font-mono">{r.lat.toFixed(4)}, {r.lon.toFixed(4)}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-outline-variant/20">
                    <Input
                      label="Latitude"
                      type="number"
                      step="any"
                      placeholder="e.g. 40.7580"
                      value={formData.latitude !== undefined && formData.latitude !== null ? formData.latitude : ''}
                      onChange={(e) => setFormData({...formData, latitude: e.target.value ? parseFloat(e.target.value) : null})}
                    />
                    <Input
                      label="Longitude"
                      type="number"
                      step="any"
                      placeholder="e.g. -73.9855"
                      value={formData.longitude !== undefined && formData.longitude !== null ? formData.longitude : ''}
                      onChange={(e) => setFormData({...formData, longitude: e.target.value ? parseFloat(e.target.value) : null})}
                    />
                  </div>
                  <Input
                    label="Resolved Address"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="Auto-filled or custom address"
                  />
                </div>
              </>
            )}
            {activeTab === 'Equipment' && (
              <>
                <Input label="Name" value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                <Input label="Quantity" type="number" value={formData.quantity || ''} onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value)})} />
                <Input label="Cost Per Day" type="number" value={formData.cost_per_day || ''} onChange={(e) => setFormData({...formData, cost_per_day: parseFloat(e.target.value)})} />
              </>
            )}
          </form>
        </Modal>

      </div>
    </AppShell>
  );
}
