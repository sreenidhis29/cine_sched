'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';

type Trace = {
  id: string;
  agent_name: string;
  timestamp: string;
  input_summary: string;
  output_summary: string;
  tool_calls: any[];
  duration_ms: number;
  confidence: string;
};

export default function TraceViewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const initialRunId = searchParams.get('run_id');

  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(initialRunId);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchTraces = async () => {
      try {
        const url = new URL(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/projects/${projectId}/trace`);
        if (currentRunId) url.searchParams.append('run_id', currentRunId);

        const token = localStorage.getItem('access_token');
        const res = await fetch(url.toString(), {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (!res.ok) throw new Error('Failed to fetch traces');
        const data = await res.json();
        
        if (data.run_id && !currentRunId) {
          setCurrentRunId(data.run_id);
        }
        
        setTraces(data.traces || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTraces();
    intervalId = setInterval(fetchTraces, 2000);

    return () => clearInterval(intervalId);
  }, [projectId, currentRunId]);

  const isComplete = traces.some(t => t.agent_name.toLowerCase().includes('explainer'));
  const isActive = traces.length > 0 && !isComplete;

  const getAgentIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('scheduler')) return 'calendar_month';
    if (lower.includes('budget')) return 'account_balance_wallet';
    if (lower.includes('critic')) return 'psychology';
    if (lower.includes('parser')) return 'data_object';
    if (lower.includes('availability')) return 'people';
    if (lower.includes('constraint')) return 'rule';
    if (lower.includes('explainer')) return 'chat';
    return 'smart_toy';
  };

  return (
    <AppShell>
      <div className="py-stack-md animate-in fade-in duration-500 flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-end pb-4 mb-stack-md flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 text-on-surface-variant font-label-md uppercase tracking-wider mb-2">
              <Link href="/projects" className="hover:text-primary-container transition-colors">Optimization Engine</Link>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span>Reasoning Trace</span>
            </div>
            
            <div className="flex items-center gap-4 mt-1">
              <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">Agent Reasoning Trace</h1>
              {traces.length > 0 && (
                <div className={`flex items-center gap-2 px-3 py-1 rounded font-label-md uppercase tracking-wider text-[11px] border ${
                  isActive 
                    ? 'bg-primary-container/10 border-primary-container text-primary-container animate-pulse' 
                    : 'bg-surface-container-high border-outline-variant text-on-surface-variant'
                }`}>
                  <span className="material-symbols-outlined text-[14px]">
                    {isActive ? 'memory' : 'task_alt'}
                  </span>
                  {isActive ? 'Optimizer Active' : 'Optimizer Complete'}
                </div>
              )}
            </div>
            {currentRunId && (
              <p className="text-on-surface-variant font-mono-data text-[12px] mt-2">Run ID: {currentRunId}</p>
            )}
          </div>
          <div className="flex gap-3">
            <Link href={`/projects/${projectId}/schedule`} className="flex items-center gap-2 bg-surface-container border border-outline-variant text-on-surface hover:border-primary-container/50 px-4 py-2 rounded font-label-md uppercase tracking-wider font-bold transition-all">
              <span className="material-symbols-outlined text-[18px]">calendar_view_week</span>
              View Schedule
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-8 flex relative">
          
          {loading && traces.length === 0 ? (
            <div className="flex justify-center items-center w-full h-full text-on-surface-variant">Loading traces...</div>
          ) : error ? (
            <div className="w-full text-error bg-error-container/20 p-4 rounded border border-error-container">
              Error: {error}
            </div>
          ) : traces.length === 0 ? (
            <div className="flex justify-center items-center w-full h-full text-on-surface-variant">No reasoning traces found for this run.</div>
          ) : (
            <div className="flex-1 max-w-4xl">
              <div className="relative pl-8">
                {/* Continuous Vertical Line */}
                <div className="absolute left-[27px] top-4 bottom-0 w-px bg-outline-variant/50" />

                <div className="space-y-8 relative">
                  {traces.map((trace, index) => (
                    <div key={trace.id} className="relative flex gap-6 animate-in slide-in-from-left-4 fade-in duration-300" style={{ animationFillMode: 'both', animationDelay: `${index * 50}ms` }}>
                      
                      {/* Timeline Marker */}
                      <div className="flex flex-col items-center mt-1 z-10 w-12 flex-shrink-0 -ml-[43px]">
                        <div className="w-10 h-10 rounded-full bg-surface-container-high border-2 border-outline-variant flex items-center justify-center shadow-sm">
                          <span className="material-symbols-outlined text-[18px] text-primary-container">
                            {getAgentIcon(trace.agent_name)}
                          </span>
                        </div>
                        <span className="font-mono-data text-[10px] text-on-surface-variant mt-2 text-center">
                          {new Date(trace.timestamp).toLocaleTimeString([], { hour12: false })}
                        </span>
                      </div>

                      {/* Trace Card */}
                      <div className="flex-1 bg-surface-container-low border border-outline-variant hover:border-primary-container/30 transition-colors shadow-sm rounded-md overflow-hidden flex flex-col">
                        <div className="p-4 flex-1">
                          <div className="flex justify-between items-start mb-3">
                            <h3 className="font-headline-md text-[16px] font-bold text-on-surface">{trace.agent_name}</h3>
                            <div className={`px-2 py-1 font-label-md text-[10px] uppercase tracking-wider border rounded-none ${
                              trace.confidence === 'high' ? 'bg-primary-container/10 border-primary-container/30 text-primary-container' :
                              trace.confidence === 'low' ? 'bg-error-container/10 border-error-container/30 text-error-container' :
                              'bg-accent/10 border-accent/30 text-accent'
                            }`}>
                              {trace.confidence} Conf
                            </div>
                          </div>
                          
                          <div className="space-y-4 font-body-md text-[13px] text-on-surface">
                            <div className="text-on-surface-variant">
                              {trace.input_summary}
                            </div>
                            
                            <div className="bg-surface-container-high p-3 border-l-2 border-primary-container text-on-surface">
                              {trace.output_summary}
                            </div>
                            
                            {/* Metrics Row (if derived from agent output, e.g. timing + any explicit stats parsed from output) */}
                            <div className="flex flex-wrap gap-4 pt-2 border-t border-outline-variant/30">
                              <div className="flex items-center gap-1 text-on-surface-variant">
                                <span className="material-symbols-outlined text-[14px]">timer</span>
                                <span className="font-mono-data text-[11px]">{trace.duration_ms}ms</span>
                              </div>
                              {trace.tool_calls && trace.tool_calls.length > 0 && (
                                <div className="flex items-center gap-1 text-on-surface-variant">
                                  <span className="material-symbols-outlined text-[14px]">build</span>
                                  <span className="font-mono-data text-[11px]">{trace.tool_calls.length} Tool(s)</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  ))}

                  {/* In-Progress Marker */}
                  {isActive && (
                    <div className="relative flex gap-6 animate-in fade-in duration-500">
                      <div className="flex flex-col items-center mt-1 z-10 w-12 flex-shrink-0 -ml-[43px]">
                        <div className="w-10 h-10 rounded-full bg-surface border-2 border-primary-container border-dashed animate-[spin_3s_linear_infinite] flex items-center justify-center shadow-sm">
                          <span className="material-symbols-outlined text-[18px] text-primary-container animate-pulse">
                            pending
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 flex items-center h-12">
                        <span className="font-label-md uppercase tracking-wider text-on-surface-variant text-[12px] animate-pulse">
                          Analyzing constraints...
                        </span>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

          {/* Optional floating technical log panel */}
          {traces.length > 0 && (
            <div className="hidden xl:flex w-[320px] flex-shrink-0 ml-6 flex-col">
              <div className="bg-[#111111] border border-outline-variant/30 rounded-md overflow-hidden flex flex-col h-full sticky top-0 max-h-[calc(100vh-160px)]">
                <div className="bg-[#1a1a1a] px-3 py-2 border-b border-outline-variant/30 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-on-surface-variant">terminal</span>
                  <span className="font-label-md text-[10px] uppercase tracking-wider text-on-surface-variant">Optimizer Kernel</span>
                </div>
                <div className="p-3 overflow-y-auto font-mono-data text-[10px] text-on-surface-variant space-y-2 custom-scrollbar">
                  {traces.map(t => (
                    <div key={`log-${t.id}`} className="space-y-1">
                      <div className="text-primary-container">[SYS] {t.agent_name.toUpperCase()} INIT ({t.duration_ms}ms)</div>
                      <div className="opacity-80">[OPT] {t.input_summary.substring(0, 60)}...</div>
                      {t.tool_calls?.map((tc, idx) => (
                        <div key={idx} className="text-accent pl-2">→ CALL {tc.tool}()</div>
                      ))}
                    </div>
                  ))}
                  {isActive && <div className="text-on-surface-variant animate-pulse">[SYS] AWAITING NEXT NODE...</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
