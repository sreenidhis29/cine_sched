'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { ProjectSelector } from '@/components/ui/ProjectSelector';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { apiClient } from '@/lib/apiClient';

export default function BudgetPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('projectId') || '';
  const [projectId, setProjectId] = useState<string>(initialProjectId);

  const handleProjectSelect = (id: string) => {
    setProjectId(id);
    router.replace(`${pathname}?projectId=${id}`);
  };
  
  const [budget, setBudget] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState<any>({
    total_limit: 0,
    cast_cap: 0,
    location_cap: 0,
    equipment_cap: 0
  });

  const fetchData = useCallback(async () => {
    if (!projectId) {
      setBudget(null);
      setSchedule(null);
      return;
    }
    setLoading(true);
    try {
      const [budgetRes, scheduleRes] = await Promise.allSettled([
        apiClient.get(`/api/projects/${projectId}/budget`),
        apiClient.get(`/api/projects/${projectId}/schedule`)
      ]);
      
      if (budgetRes.status === 'fulfilled' && budgetRes.value) {
        setBudget(budgetRes.value);
        setFormData({
          total_limit: budgetRes.value.total_limit || 0,
          cast_cap: budgetRes.value.cast_cap || 0,
          location_cap: budgetRes.value.location_cap || 0,
          equipment_cap: budgetRes.value.equipment_cap || 0
        });
      } else {
        // Budget might be 404 if not set yet
        setBudget(null);
        setFormData({ total_limit: 0, cast_cap: 0, location_cap: 0, equipment_cap: 0 });
      }

      if (scheduleRes.status === 'fulfilled' && scheduleRes.value) {
        setSchedule(scheduleRes.value);
      } else {
        setSchedule(null);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiClient.put(`/api/projects/${projectId}/budget`, formData);
      setBudget(res);
      alert('Budget saved successfully');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const totalCost = schedule?.total_cost || 0;
  const totalLimit = budget?.total_limit || 1; // prevent div by zero
  const totalPercent = Math.min(100, Math.max(0, (totalCost / totalLimit) * 100));

  return (
    <AppShell>
      <div className="py-stack-md animate-in fade-in duration-500 flex flex-col min-h-0 h-[calc(100vh-64px)] overflow-hidden">
        
        <div className="flex justify-between items-end pb-4 mb-stack-md border-b border-outline-variant/30 flex-shrink-0">
          <div>
            <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">Budget Monitor</h1>
            <p className="text-on-surface-variant font-body-md mt-1">Manage budget caps and track estimated costs.</p>
          </div>
        </div>

        <ProjectSelector selectedId={projectId} onSelect={handleProjectSelect} />

        {projectId ? (
          <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 pb-8">
            
            <Card className="flex-1 max-w-xl h-fit">
              <h2 className="font-headline-md text-[18px] text-on-surface mb-4">Edit Budget Caps</h2>
              <form className="space-y-4" onSubmit={handleSave}>
                <Input 
                  label="Total Project Limit ($)" 
                  type="number" 
                  value={formData.total_limit || ''} 
                  onChange={(e) => setFormData({...formData, total_limit: parseFloat(e.target.value)})} 
                  required 
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Cast Cap ($)" 
                    type="number" 
                    value={formData.cast_cap || ''} 
                    onChange={(e) => setFormData({...formData, cast_cap: parseFloat(e.target.value)})} 
                  />
                  <Input 
                    label="Location Cap ($)" 
                    type="number" 
                    value={formData.location_cap || ''} 
                    onChange={(e) => setFormData({...formData, location_cap: parseFloat(e.target.value)})} 
                  />
                  <Input 
                    label="Equipment Cap ($)" 
                    type="number" 
                    value={formData.equipment_cap || ''} 
                    onChange={(e) => setFormData({...formData, equipment_cap: parseFloat(e.target.value)})} 
                  />
                </div>
                <div className="pt-4 border-t border-outline-variant/30 flex justify-end">
                  <button 
                    type="submit" 
                    disabled={saving} 
                    className="px-6 py-2 bg-primary-container text-on-primary-fixed-variant font-bold font-label-md uppercase rounded shadow-lg hover:brightness-110 active:scale-95 transition-all"
                  >
                    {saving ? 'Saving...' : 'Save Budget'}
                  </button>
                </div>
              </form>
            </Card>

            <Card className="flex-1 max-w-xl h-fit bg-surface-container border-primary-container/20">
              <h2 className="font-headline-md text-[18px] text-on-surface mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-container">monitoring</span>
                Cost vs Cap Tracking
              </h2>
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <div className="font-label-md uppercase tracking-wider text-on-surface-variant text-[11px]">Total Estimated Cost</div>
                      <div className="font-mono-data text-[24px] text-on-surface mt-1">${totalCost.toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-label-md uppercase tracking-wider text-on-surface-variant text-[11px]">Total Limit</div>
                      <div className="font-mono-data text-[16px] text-on-surface-variant mt-1">${budget?.total_limit?.toLocaleString() || 0}</div>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-surface-bright rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${totalPercent > 90 ? 'bg-error' : totalPercent > 75 ? 'bg-accent' : 'bg-primary-container'}`}
                      style={{ width: `${totalPercent}%` }} 
                    />
                  </div>
                  <div className="text-right font-mono-data text-[12px] text-on-surface-variant mt-1">
                    {totalPercent.toFixed(1)}% used
                  </div>
                </div>

                <div className="p-4 bg-surface-container-low rounded border border-outline-variant/50 text-sm text-on-surface-variant italic">
                  Note: Detailed breakdown by category (Cast, Location, Equipment) requires running a full schedule with cost allocation. Run the AI Scheduler on the project page to update the estimated total cost.
                </div>
              </div>
            </Card>

          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-on-surface-variant italic">
            Please select a project to view its budget.
          </div>
        )}
      </div>
    </AppShell>
  );
}
