'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { DataTable } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/Input';

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const baseUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/projects/${projectId}`;

        const [projRes, scenesRes, castRes, locsRes, equipRes] = await Promise.all([
          fetch(baseUrl, { headers }),
          fetch(`${baseUrl}/scenes`, { headers }),
          fetch(`${baseUrl}/cast`, { headers }),
          fetch(`${baseUrl}/locations`, { headers }),
          fetch(`${baseUrl}/equipment`, { headers }),
        ]);

        if (projRes.ok) setProject(await projRes.json());
        if (scenesRes.ok) setScenes(await scenesRes.json());
        if (castRes.ok) setCast(await castRes.json());
        if (locsRes.ok) setLocations(await locsRes.json());
        if (equipRes.ok) setEquipment(await equipRes.json());

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  const handleRunScheduler = async () => {
    setRunning(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/projects/${projectId}/run`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        // Redirect to trace with run_id
        router.push(`/projects/${projectId}/trace?run_id=${data.run_id}`);
      } else {
        console.error('Failed to run scheduler');
        setRunning(false);
      }
    } catch (err) {
      console.error(err);
      setRunning(false);
    }
  };

  const tabs = ['Scenes', 'Cast', 'Locations', 'Equipment'];

  const getColumns = () => {
    if (activeTab === 'Scenes') {
      return [
        { header: 'Scene', accessorKey: 'scene_number', align: 'center' as const },
        { header: 'Title', accessorKey: 'title' },
        { header: 'Setting', accessorKey: 'setting' },
        { header: 'Duration (min)', accessorKey: 'duration_minutes', isNumeric: true },
        {
          header: 'Actions',
          accessorKey: 'actions',
          align: 'right' as const,
          cell: (row: any) => (
            <div className="flex justify-end gap-2 text-on-surface-variant">
              <button className="p-1 hover:text-primary-container transition-colors"><span className="material-symbols-outlined text-[18px]">edit</span></button>
            </div>
          )
        }
      ];
    }
    if (activeTab === 'Cast') {
      return [
        { header: 'Name', accessorKey: 'name' },
        { header: 'Role', accessorKey: 'role' },
        { header: 'Cost/Day', accessorKey: 'cost_per_day', isNumeric: true }
      ];
    }
    if (activeTab === 'Locations') {
      return [
        { header: 'Name', accessorKey: 'name' },
        { header: 'Cost/Day', accessorKey: 'cost_per_day', isNumeric: true }
      ];
    }
    if (activeTab === 'Equipment') {
      return [
        { header: 'Name', accessorKey: 'name' },
        { header: 'Quantity', accessorKey: 'quantity', isNumeric: true },
        { header: 'Cost/Day', accessorKey: 'cost_per_day', isNumeric: true }
      ];
    }
    return [];
  };

  const getData = () => {
    if (activeTab === 'Scenes') return scenes;
    if (activeTab === 'Cast') return cast;
    if (activeTab === 'Locations') return locations;
    if (activeTab === 'Equipment') return equipment;
    return [];
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
              onClick={() => setActiveTab(tab)}
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
            <Input icon="search" placeholder={`Search ${activeTab.toLowerCase()}...`} className="py-2 text-sm" />
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 border border-outline-variant text-on-surface hover:bg-surface-variant/50 px-3 py-2 rounded font-label-md uppercase tracking-wider transition-all">
              <span className="material-symbols-outlined text-[18px]">filter_list</span>
              Filters
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-surface-container-low rounded-lg border border-outline-variant shadow-xl overflow-hidden min-h-[300px]">
          {loading ? (
            <div className="flex justify-center items-center h-full min-h-[300px] text-on-surface-variant">Loading {activeTab}...</div>
          ) : (
            <DataTable data={getData()} columns={getColumns()} />
          )}
        </div>

      </div>
    </AppShell>
  );
}
