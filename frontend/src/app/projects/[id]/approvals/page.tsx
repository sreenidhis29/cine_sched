'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';

export default function ApprovalsPage() {
  const { id: projectId } = useParams();
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApprovals = async () => {
    try {
      const data = await apiClient.get(`/api/projects/${projectId}/approvals`);
      setApprovals(data || []);
    } catch (e) {
      console.error("Failed to fetch approvals", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchApprovals();
  }, [projectId]);

  const handleAction = async (runId: string, action: 'approve' | 'reject') => {
    try {
      await apiClient.post(`/api/projects/${projectId}/${action}/${runId}`, {});
      fetchApprovals();
    } catch (e: any) {
      alert(`Failed to ${action} schedule: ${e.message}`);
    }
  };

  if (loading) return <div className="p-8 text-on-surface-variant">Loading approvals...</div>;

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="font-display-sm text-3xl font-bold mb-8 text-on-surface">Schedule Approvals</h1>

      {approvals.length === 0 ? (
        <div className="bg-surface-container-low p-8 rounded-2xl border border-outline-variant/30 text-center text-on-surface-variant">
          No approvals pending or processed.
        </div>
      ) : (
        <div className="space-y-6">
          {approvals.map(approval => (
            <div key={approval.id} className="bg-surface-container p-6 rounded-2xl shadow-sm border border-outline-variant/30">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-headline-sm text-xl text-primary-container font-bold mb-1">Run {approval.run_id.slice(0, 8)}...</h3>
                  <p className="text-on-surface-variant text-sm">Created: {new Date(approval.created_at).toLocaleString()}</p>
                </div>
                <div className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-surface-variant text-on-surface">
                  {approval.status}
                </div>
              </div>

              <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/50 mb-6">
                <h4 className="text-sm font-bold text-on-surface mb-2 uppercase tracking-wide">Threshold Reason</h4>
                <p className="text-on-surface-variant leading-relaxed">
                  {approval.threshold_reason}
                </p>
              </div>

              {approval.status === 'pending' ? (
                <div className="flex gap-4">
                  <button
                    onClick={() => handleAction(approval.run_id, 'approve')}
                    className="px-6 py-2 bg-primary text-on-primary rounded font-bold hover:brightness-110 active:scale-[0.98] transition-all"
                  >
                    Approve Schedule
                  </button>
                  <button
                    onClick={() => handleAction(approval.run_id, 'reject')}
                    className="px-6 py-2 bg-error text-on-error rounded font-bold hover:brightness-110 active:scale-[0.98] transition-all"
                  >
                    Reject Schedule
                  </button>
                </div>
              ) : (
                <div className="text-sm text-on-surface-variant">
                  {approval.status === 'approved' ? 'Approved' : 'Rejected'} by {approval.approver_name || 'Unknown'} on {new Date(approval.approved_at).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
