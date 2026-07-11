'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { ProjectSelector } from '@/components/ui/ProjectSelector';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { apiClient } from '@/lib/apiClient';

export default function LocationsPage() {
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
  const [loading, setLoading] = useState(false);
  
  // CRUD State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!projectId) {
      setData([]);
      return;
    }
    setLoading(true);
    try {
      const endpoint = `/api/projects/${projectId}/locations`;
      const res = await apiClient.get(endpoint);
      setData(res || []);
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

  const columns = [
    { header: 'Name', accessorKey: 'name' },
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
          <div className="flex flex-col flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 pb-8">
            
            {/* Content Controls */}
            <div className="flex justify-between items-center mb-stack-md flex-shrink-0">
              <div className="w-1/3">
                <Input icon="search" placeholder="Search locations..." className="py-2 text-sm" />
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

            {/* Data Table */}
            <div className="bg-surface-container-low rounded-lg border border-outline-variant shadow-xl overflow-hidden min-h-[300px]">
              {loading ? (
                <div className="flex justify-center items-center h-full min-h-[300px] text-on-surface-variant">Loading locations...</div>
              ) : (
                <DataTable data={data} columns={columns} />
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
                <Input label="Name" value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                <Input label="Cost Per Day" type="number" value={formData.cost_per_day || ''} onChange={(e) => setFormData({...formData, cost_per_day: parseFloat(e.target.value)})} />
              </form>
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
