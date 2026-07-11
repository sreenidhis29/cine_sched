'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { apiClient } from '@/lib/apiClient';

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get('/api/auth/admin/summary');
      setSummary(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load administrator summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleDeleteOrg = async (orgId: string, orgName: string) => {
    if (!confirm(`Are you sure you want to delete the organization "${orgName}"? This will delete all its projects and schedules.`)) return;
    try {
      await apiClient.delete(`/api/auth/admin/organizations/${orgId}`);
      fetchSummary();
    } catch (err: any) {
      alert(`Error deleting organization: ${err.message}`);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete the user "${userEmail}"?`)) return;
    try {
      await apiClient.delete(`/api/auth/admin/users/${userId}`);
      fetchSummary();
    } catch (err: any) {
      alert(`Error deleting user: ${err.message}`);
    }
  };

  return (
    <AppShell>
      <div className="py-stack-md animate-in fade-in duration-500 flex flex-col min-h-0 h-[calc(100vh-64px)] overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-end pb-4 mb-stack-md border-b border-outline-variant/30 flex-shrink-0">
          <div>
            <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[28px] text-primary-container">admin_panel_settings</span>
              App Super Admin Dashboard
            </h1>
            <p className="text-on-surface-variant font-body-md mt-1">Manage global system organizations and user accounts.</p>
          </div>
          <button 
            onClick={fetchSummary}
            className="flex items-center gap-2 border border-outline-variant text-on-surface hover:bg-surface-variant/40 px-3 py-2 rounded font-label-md uppercase tracking-wider transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Refresh
          </button>
        </div>

        {error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-error-container/20 border border-error-container p-6 rounded-lg max-w-md text-center">
              <span className="material-symbols-outlined text-error-container text-[48px] mb-2">warning</span>
              <h3 className="font-headline-sm font-bold text-on-surface mb-2">Access Denied</h3>
              <p className="text-on-surface-variant text-sm mb-4">{error}</p>
            </div>
          </div>
        ) : loading && !summary ? (
          <div className="flex-grow flex items-center justify-center text-on-surface-variant">Loading Admin Summary...</div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-8 space-y-8">
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
              <Card className="p-6 flex items-center gap-4 bg-surface-container-high/40">
                <div className="w-12 h-12 rounded bg-primary-container/20 flex items-center justify-center text-primary-container">
                  <span className="material-symbols-outlined text-[28px]">domain</span>
                </div>
                <div>
                  <div className="text-[11px] font-label-md uppercase tracking-wider text-on-surface-variant">Total Organizations</div>
                  <div className="font-headline-lg text-[24px] font-bold text-on-surface mt-0.5">{summary?.organizations?.length || 0}</div>
                </div>
              </Card>
              <Card className="p-6 flex items-center gap-4 bg-surface-container-high/40">
                <div className="w-12 h-12 rounded bg-primary-container/20 flex items-center justify-center text-primary-container">
                  <span className="material-symbols-outlined text-[28px]">group</span>
                </div>
                <div>
                  <div className="text-[11px] font-label-md uppercase tracking-wider text-on-surface-variant">Total Users</div>
                  <div className="font-headline-lg text-[24px] font-bold text-on-surface mt-0.5">{summary?.users?.length || 0}</div>
                </div>
              </Card>
            </div>

            {/* Organizations Management */}
            <Card className="p-6">
              <h2 className="font-headline-md text-[18px] text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary-container">domain</span>
                Organizations
              </h2>
              <div className="bg-surface-container border border-outline-variant rounded overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-container-low border-b border-outline-variant/50">
                    <tr>
                      <th className="px-4 py-3 font-label-md uppercase text-on-surface-variant">Name</th>
                      <th className="px-4 py-3 font-label-md uppercase text-on-surface-variant">Owner Email</th>
                      <th className="px-4 py-3 font-label-md uppercase text-on-surface-variant text-center">Projects</th>
                      <th className="px-4 py-3 font-label-md uppercase text-on-surface-variant text-center">Members</th>
                      <th className="px-4 py-3 font-label-md uppercase text-on-surface-variant text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {summary?.organizations?.map((o: any) => (
                      <tr key={o.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="px-4 py-3 font-bold text-on-surface">{o.name}</td>
                        <td className="px-4 py-3 text-on-surface-variant font-mono text-xs">{o.owner}</td>
                        <td className="px-4 py-3 text-on-surface text-center font-bold">{o.project_count}</td>
                        <td className="px-4 py-3 text-on-surface text-center font-bold">{o.member_count}</td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => handleDeleteOrg(o.id, o.name)} 
                            className="text-error hover:text-error/80 transition-colors p-1"
                            title="Delete Organization"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {summary?.organizations?.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center p-6 text-on-surface-variant italic">No organizations in the system</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Users Management */}
            <Card className="p-6">
              <h2 className="font-headline-md text-[18px] text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary-container">group</span>
                User Accounts
              </h2>
              <div className="bg-surface-container border border-outline-variant rounded overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-container-low border-b border-outline-variant/50">
                    <tr>
                      <th className="px-4 py-3 font-label-md uppercase text-on-surface-variant">Name</th>
                      <th className="px-4 py-3 font-label-md uppercase text-on-surface-variant">Email</th>
                      <th className="px-4 py-3 font-label-md uppercase text-on-surface-variant">Global Role</th>
                      <th className="px-4 py-3 font-label-md uppercase text-on-surface-variant">Organizations</th>
                      <th className="px-4 py-3 font-label-md uppercase text-on-surface-variant text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {summary?.users?.map((u: any) => (
                      <tr key={u.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="px-4 py-3 font-bold text-on-surface">{u.name}</td>
                        <td className="px-4 py-3 text-on-surface-variant font-mono text-xs">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded font-bold uppercase ${u.role === 'admin' ? 'bg-primary-container/20 text-primary-container' : 'bg-outline-variant/20 text-on-surface-variant'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant text-xs truncate max-w-[200px]" title={u.organizations.join(', ')}>
                          {u.organizations.join(', ') || 'None'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {u.role !== 'admin' && (
                            <button 
                              onClick={() => handleDeleteUser(u.id, u.email)} 
                              className="text-error hover:text-error/80 transition-colors p-1"
                              title="Delete User"
                            >
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

          </div>
        )}
      </div>
    </AppShell>
  );
}
