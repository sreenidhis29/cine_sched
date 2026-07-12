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

const budgetSteps = [
  "Loading location and cast costs...",
  "Applying route travel costs...",
  "Applying shoot-window date costs...",
  "Computing category breakdown...",
  "Done."
];

function BudgetPlanPageContent() {
  const { id: projectId } = useParams();
  const router = useRouter();

  const [budgetPlan, setBudgetPlan] = useState<any>(null);
  const [projectMetadata, setProjectMetadata] = useState<any>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(true);

  // Modal configuration states for Recompute
  const [modalOpen, setModalOpen] = useState(false);
  const [crewHourlyRate, setCrewHourlyRate] = useState<number>(500);
  const [includeRoutePlan, setIncludeRoutePlan] = useState<boolean>(true);
  const [includeShootPlan, setIncludeShootPlan] = useState<boolean>(true);
  const [planningBudget, setPlanningBudget] = useState(false);

  const [loadingRuns, setLoadingRuns] = useState(true);

  const handleRecompute = async () => {
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
      setBudgetPlan(res);
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Failed to recompute budget plan. Please try again.');
    } finally {
      setPlanningBudget(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoadingRuns(true);
      try {
        const run = await apiClient.get(`/api/projects/${projectId}/planner-runs?plan_type=budget`);
        if (run && run.result_json) {
          setBudgetPlan(run.result_json);
          if (run.config_json && run.config_json.crew_hourly_rate) {
            setCrewHourlyRate(run.config_json.crew_hourly_rate);
          }
        } else {
          const stored = sessionStorage.getItem(`last_budget_plan_result_${projectId}`);
          if (stored) {
            setBudgetPlan(JSON.parse(stored));
          }
        }
      } catch (e) {
        console.error('Error fetching latest budget plan:', e);
      } finally {
        setLoadingRuns(false);
      }

      try {
        const res = await apiClient.get(`/api/projects/${projectId}`);
        setProjectMetadata(res || {});
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
          <span className="text-on-surface-variant font-medium mt-4">Loading Cost Planner...</span>
        </div>
      </AppShell>
    );
  }

  if (!budgetPlan) {
    return (
      <AppShell>
        <div className="py-stack-md flex flex-col min-h-0 h-[calc(100vh-64px)] justify-center items-center text-center px-6">
          <div className="w-16 h-16 rounded-full bg-primary-container/10 flex items-center justify-center border border-primary-container/20 mb-4">
            <span className="material-symbols-outlined text-primary-container text-[32px]">payments</span>
          </div>
          <h2 className="font-headline-md text-[18px] text-on-surface font-bold mb-2">No Saved Cost Plan</h2>
          <p className="text-on-surface-variant font-body-md max-w-md mb-6">
            Compare actual and estimated production budget breakdowns. Running the planner integrates travel duration costs, weather shoot days, and project category caps.
          </p>
          <button 
            onClick={() => setModalOpen(true)}
            className="px-6 py-2.5 bg-primary-container text-on-primary-fixed font-bold font-label-md uppercase rounded hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            Run Cost Planner
          </button>

          <Modal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Configure Budget Planner"
            sidePanel={<AgentActivityPanel isActive={planningBudget} steps={budgetSteps} />}
            footer={
              <>
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 font-label-md uppercase hover:bg-surface-variant rounded transition-colors text-on-surface-variant">Cancel</button>
                <button onClick={handleRecompute} disabled={planningBudget} className="px-4 py-2 bg-primary-container text-on-primary-fixed-variant font-bold font-label-md uppercase rounded hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5">
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
            <div className="space-y-6 py-2 text-left">
              
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
      </AppShell>
    );
  }

  const isOverBudget = budgetPlan.over_under_amount < 0;
  const budgetUtilization = budgetPlan.budget_cap > 0 
    ? Math.round((budgetPlan.optimized_total / budgetPlan.budget_cap) * 100)
    : 0;

  return (
    <AppShell>
      <div className="py-stack-md animate-in fade-in duration-500 flex flex-col min-h-0 h-[calc(100vh-64px)] overflow-hidden">
        
        {/* Header Block */}
        <div className="flex justify-between items-center pb-4 mb-stack-md border-b border-outline-variant/30 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-container">payments</span>
              <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">Budget cost Breakdown</h1>
            </div>
            <p className="text-on-surface-variant font-body-md mt-1">
              Advisory budget analysis combining route and shoot-window optimizations.
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

        {/* Content Scroll Container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-8 space-y-6 min-h-0">
          
          {/* Cost Savings Banner */}
          {budgetPlan.savings > 0 && (
            <div className="bg-primary-container/10 border border-primary-container/20 px-4 py-3 rounded-xl flex justify-between items-center">
              <div className="flex items-center gap-2 text-sm text-on-surface">
                <span className="material-symbols-outlined text-primary-container">bolt</span>
                <span>
                  Budget optimization saves you <strong>${budgetPlan.savings.toLocaleString()}</strong> in crew hours and travel accommodation costs!
                </span>
              </div>
              <span className="bg-primary-container text-on-primary-fixed text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                Saves ${Math.round(budgetPlan.savings).toLocaleString()}
              </span>
            </div>
          )}

          {/* Budget Limit vs Total Cost Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-surface-container-low border-outline-variant/30 p-5 flex flex-col justify-center">
              <span className="text-xs font-label-md text-on-surface-variant uppercase tracking-wider">Total Optimized Estimate</span>
              <span className="font-mono-data text-3xl font-extrabold text-primary-container mt-1">
                ${budgetPlan.optimized_total.toLocaleString()}
              </span>
            </Card>

            <Card className="bg-surface-container-low border-outline-variant/30 p-5 flex flex-col justify-center">
              <span className="text-xs font-label-md text-on-surface-variant uppercase tracking-wider">Budget Cap Limit</span>
              <span className="font-mono-data text-3xl font-extrabold text-on-surface mt-1">
                ${budgetPlan.budget_cap.toLocaleString()}
              </span>
            </Card>

            <Card className={`bg-surface-container-low border-outline-variant/30 p-5 flex flex-col justify-center ${isOverBudget ? 'border-error/30 bg-error/5' : 'border-success/30 bg-success/5'}`}>
              <span className="text-xs font-label-md text-on-surface-variant uppercase tracking-wider">
                {isOverBudget ? 'Over Budget By' : 'Remaining Balance'}
              </span>
              <span className={`font-mono-data text-3xl font-extrabold mt-1 ${isOverBudget ? 'text-error' : 'text-success'}`}>
                ${Math.abs(budgetPlan.over_under_amount).toLocaleString()}
              </span>
            </Card>
          </div>

          {/* Budget Progress Gauge */}
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-5 shadow-md">
            <div className="flex justify-between items-center mb-2 text-xs font-label-md uppercase tracking-wider text-on-surface-variant">
              <span>Budget Cap Utilization</span>
              <span className="font-bold font-mono-data text-on-surface">{budgetUtilization}%</span>
            </div>
            <div className="w-full h-3 bg-surface-container border border-outline-variant/20 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${isOverBudget ? 'bg-error' : 'bg-amber-500'}`} 
                style={{ width: `${Math.min(100, budgetUtilization)}%` }} 
              />
            </div>
          </div>

          {/* Cost Breakdown Category List */}
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl overflow-hidden shadow-lg">
            <h2 className="font-headline-sm text-headline-sm text-primary-container font-bold p-4 bg-surface-container border-b border-outline-variant/20 uppercase tracking-wider">
              Category Cost Breakdown
            </h2>

            <div className="divide-y divide-outline-variant/25">
              {budgetPlan.categories.map((cat: any) => (
                <div key={cat.name} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-2 hover:bg-surface-container/30 transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-on-surface">{cat.name}</span>
                      {cat.is_estimate ? (
                        <span className="text-[9px] bg-outline-variant/20 text-on-surface-variant border border-outline-variant/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                          Estimate
                        </span>
                      ) : (
                        <span className="text-[9px] bg-primary-container/20 text-primary-container border border-primary-container/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                          Optimized
                        </span>
                      )}
                    </div>
                    {cat.note && (
                      <p className="text-xs text-on-surface-variant italic font-body-md">
                        {cat.note}
                      </p>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <span className="font-mono-data text-base font-bold text-on-surface">
                      ${cat.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Modal for Recompute */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Configure Budget Planner"
          sidePanel={<AgentActivityPanel isActive={planningBudget} steps={budgetSteps} />}
          footer={
            <>
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 font-label-md uppercase hover:bg-surface-variant rounded transition-colors text-on-surface-variant">Cancel</button>
              <button onClick={handleRecompute} disabled={planningBudget} className="px-4 py-2 bg-primary-container text-on-primary-fixed-variant font-bold font-label-md uppercase rounded hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5">
                {planningBudget ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    Calculating...
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
    </AppShell>
  );
}

export default function BudgetPlanPage() {
  return (
    <React.Suspense fallback={
      <AppShell>
        <div className="p-8 text-center text-on-surface-variant italic font-body-md">
          Loading Budget Plan...
        </div>
      </AppShell>
    }>
      <BudgetPlanPageContent />
    </React.Suspense>
  );
}
