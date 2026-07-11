'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { apiClient } from '@/lib/apiClient';

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
  const runId = searchParams.get('run_id');

  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchTraces = async () => {
      try {
        let endpoint = `/api/projects/${projectId}/trace`;
        if (runId) endpoint += `?run_id=${runId}`;

        const data = await apiClient.get(endpoint);

        if (data) setTraces(data.traces || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTraces();
    // Poll every 2 seconds
    intervalId = setInterval(fetchTraces, 2000);

    return () => clearInterval(intervalId);
  }, [projectId, runId]);

  return (
    <AppShell>
      <div className="py-stack-md animate-in fade-in duration-500 flex flex-col h-[calc(100vh-64px)] overflow-hidden">

        {/* Header */}
        <div className="flex justify-between items-end pb-4 mb-stack-md flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 text-on-surface-variant font-label-md uppercase tracking-wider mb-2">
              <Link href="/projects" className="hover:text-primary-container transition-colors">Projects</Link>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <Link href={`/projects/${projectId}`} className="hover:text-primary-container transition-colors">Project</Link>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span>Reasoning Trace</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">Agent Reasoning Trace</h1>
            <p className="text-on-surface-variant font-body-md mt-1">Live execution log for the scheduling pipeline</p>
          </div>
          <div className="flex gap-3">
            <Link href={`/projects/${projectId}/schedule`} className="flex items-center gap-2 bg-surface-container border border-outline-variant text-on-surface hover:border-primary-container/50 px-4 py-2 rounded font-label-md uppercase tracking-wider font-bold transition-all">
              <span className="material-symbols-outlined text-[18px]">calendar_view_week</span>
              View Schedule
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-8">
          {loading && traces.length === 0 ? (
            <div className="flex justify-center items-center h-full text-on-surface-variant">Loading traces...</div>
          ) : error ? (
            <div className="text-error bg-error-container/20 p-4 rounded border border-error-container">
              Error: {error}
            </div>
          ) : traces.length === 0 ? (
            <div className="flex justify-center items-center h-full text-on-surface-variant">No reasoning traces found for this run.</div>
          ) : (
            <div className="space-y-4">
              {traces.map((trace, index) => (
                <Card key={trace.id} className={`bg-surface-container-low border-l-4 ${trace.confidence === 'low' ? 'border-l-error' : trace.confidence === 'high' ? 'border-l-primary-container' : 'border-l-accent'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-bright flex items-center justify-center border border-outline-variant/50">
                        <span className="material-symbols-outlined text-[16px] text-primary-container">
                          {trace.agent_name.toLowerCase().includes('critic') ? 'psychology' :
                            trace.agent_name.toLowerCase().includes('budget') ? 'account_balance_wallet' :
                              trace.agent_name.toLowerCase().includes('parser') ? 'data_object' :
                                trace.agent_name.toLowerCase().includes('explainer') ? 'chat' : 'smart_toy'}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-headline-md text-[16px] font-bold text-on-surface">{trace.agent_name}</h3>
                        <span className="font-mono-data text-[11px] text-on-surface-variant">
                          {new Date(trace.timestamp).toLocaleTimeString()} • {trace.duration_ms}ms
                        </span>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded font-label-md text-[10px] uppercase tracking-wider border ${trace.confidence === 'high' ? 'bg-primary-container/10 border-primary-container/30 text-primary-container' :
                      trace.confidence === 'low' ? 'bg-error-container/10 border-error-container/30 text-error-container' :
                        'bg-accent/10 border-accent/30 text-accent'
                      }`}>
                      {trace.confidence} Confidence
                    </div>
                  </div>

                  <div className="space-y-3 font-body-md text-[13px] text-on-surface ml-11">
                    <div>
                      <span className="text-on-surface-variant font-bold block mb-1">Input Context</span>
                      <div className="bg-surface-container p-2 rounded border border-outline-variant/30 text-on-surface-variant">
                        {trace.input_summary}
                      </div>
                    </div>

                    {trace.tool_calls && trace.tool_calls.length > 0 && (
                      <div>
                        <span className="text-on-surface-variant font-bold block mb-1">Tools Executed</span>
                        <div className="flex gap-2 flex-wrap">
                          {trace.tool_calls.map((tc, idx) => (
                            <span key={idx} className="bg-surface-bright font-mono-data text-[11px] px-2 py-1 rounded border border-outline-variant/50 text-accent">
                              {tc.tool}(...)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <span className="text-on-surface-variant font-bold block mb-1">Output / Decision</span>
                      <div className="bg-surface-container-high p-3 rounded border border-outline-variant">
                        {trace.output_summary}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
