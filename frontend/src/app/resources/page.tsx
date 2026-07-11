'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { ProjectSelector } from '@/components/ui/ProjectSelector';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { apiClient } from '@/lib/apiClient';

export default function ResourcesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('projectId') || '';
  const [projectId, setProjectId] = useState<string>(initialProjectId);

  const handleProjectSelect = (id: string) => {
    setProjectId(id);
    router.replace(`${pathname}?projectId=${id}`);
  };
  const [activeTab, setActiveTab] = useState('Cast');
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
      const endpoint = `/api/projects/${projectId}/${activeTab.toLowerCase()}`;
      const res = await apiClient.get(endpoint);
      setData(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, activeTab]);

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
    if (!confirm('Are you sure you want to delete this resource?')) return;
    try {
      await apiClient.delete(`/api/projects/${projectId}/${activeTab.toLowerCase()}/${item.id}`);
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

  const tabs = ['Cast', 'Equipment'];

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

    if (activeTab === 'Cast') {
      return [
        { header: 'Name', accessorKey: 'name' },
        { header: 'Role', accessorKey: 'role' },
        { header: 'Linked Email', accessorKey: 'linked_email' },
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

  return (
    <AppShell>
      <div className="py-stack-md animate-in fade-in duration-500 flex flex-col min-h-0 h-[calc(100vh-64px)] overflow-hidden">
        
        <div className="flex justify-between items-end pb-4 mb-stack-md border-b border-outline-variant/30 flex-shrink-0">
          <div>
            <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">Resource Manager</h1>
            <p className="text-on-surface-variant font-body-md mt-1">Manage cast and equipment availability.</p>
          </div>
        </div>

        <ProjectSelector selectedId={projectId} onSelect={handleProjectSelect} />

        {projectId ? (
          <div className="flex flex-col flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 pb-8">
            {/* Sub-nav */}
            <div className="flex gap-8 border-b border-outline-variant/30 mb-stack-md overflow-x-auto custom-scrollbar flex-shrink-0">
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
            <div className="flex justify-between items-center mb-stack-md flex-shrink-0">
              <div className="w-1/3">
                <Input icon="search" placeholder={`Search ${activeTab.toLowerCase()}...`} className="py-2 text-sm" />
              </div>
              <div className="flex gap-3">
                <button onClick={handleAdd} className="flex items-center gap-2 border border-outline-variant text-on-surface hover:bg-primary-container hover:text-on-primary-fixed-variant px-3 py-2 rounded font-label-md uppercase tracking-wider transition-all">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Add {activeTab}
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
                <div className="flex justify-center items-center h-full min-h-[300px] text-on-surface-variant">Loading {activeTab}...</div>
              ) : (
                <DataTable data={data} columns={getColumns()} />
              )}
            </div>

            {/* Modal for Add/Edit */}
            <Modal 
              isOpen={modalOpen} 
              onClose={() => setModalOpen(false)} 
              title={`${editingItem ? 'Edit' : 'Add'} ${activeTab}`}
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
                {activeTab === 'Cast' && (
                  <>
                    <Input label="Name" value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                    <Input label="Role" value={formData.role || ''} onChange={(e) => setFormData({...formData, role: e.target.value})} required />
                    <Input label="Linked Email (Optional)" type="email" placeholder="Connect to User Account" value={formData.linked_email || ''} onChange={(e) => setFormData({...formData, linked_email: e.target.value})} />
                    <Input label="Cost Per Day" type="number" value={formData.cost_per_day || ''} onChange={(e) => setFormData({...formData, cost_per_day: parseFloat(e.target.value)})} />
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
        ) : (
          <div className="flex-1 flex items-center justify-center text-on-surface-variant italic">
            Please select a project to view resources.
          </div>
        )}
      </div>
    </AppShell>
  );
}
