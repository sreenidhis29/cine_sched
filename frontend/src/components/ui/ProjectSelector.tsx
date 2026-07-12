import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';

interface ProjectSelectorProps {
  onSelect: (projectId: string) => void;
  selectedId?: string;
}

export function ProjectSelector({ onSelect, selectedId }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const activeOrgId = sessionStorage.getItem('active_org_id');
    const endpoint = activeOrgId ? `/api/projects?org_id=${activeOrgId}` : '/api/projects';
    
    apiClient.get(endpoint)
      .then((data: any[]) => {
        if (!isMounted) return;
        setProjects(data || []);
        if (data && data.length > 0 && !selectedId) {
          onSelect(data[0].id);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (isMounted) setLoading(false);
      });
      
    return () => { isMounted = false; };
  }, [selectedId, onSelect]);

  return (
    <div className="flex items-center gap-3 bg-surface-container-low border border-outline-variant/50 p-3 rounded-lg mb-6 shadow-sm">
      <span className="material-symbols-outlined text-primary-container text-[20px]">movie</span>
      <span className="font-label-md uppercase tracking-wider text-on-surface-variant">Active Project:</span>
      <select 
        value={selectedId || ''} 
        onChange={e => onSelect(e.target.value)}
        disabled={loading}
        className="bg-surface-container border border-outline-variant rounded px-4 py-2 text-sm font-bold text-on-surface focus:outline-none focus:border-primary-container min-w-[240px] appearance-none cursor-pointer hover:border-primary-container/50 transition-colors"
        style={{ backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23a1a1aa%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.7rem top 50%', backgroundSize: '1rem auto' }}
      >
        {loading && <option value="">Loading Projects...</option>}
        {!loading && projects.length === 0 && <option value="">No Projects Found</option>}
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}
