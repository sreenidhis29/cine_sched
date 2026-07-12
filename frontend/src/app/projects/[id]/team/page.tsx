'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { AppShell } from '@/components/layout/AppShell';
import Loader from '@/components/ui/Loader';

export default function ProjectTeamPage() {
  const { id: projectId } = useParams();
  
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  
  const fetchTeamData = async () => {
    try {
      setLoading(true);
      // Fetch project members
      const pMembers = await apiClient.get(`/api/projects/${projectId}/members`);
      setProjectMembers(pMembers || []);
      
      // Fetch org members for the active org
      const activeOrgId = sessionStorage.getItem('active_org_id');
      if (activeOrgId) {
        const oMembers = await apiClient.get(`/api/organizations/${activeOrgId}/members`);
        setOrgMembers(oMembers || []);
      }
    } catch (e) {
      console.error("Failed to fetch team data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchTeamData();
  }, [projectId]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    
    try {
      await apiClient.patch(`/api/projects/${projectId}/members/${selectedUserId}/role`, {
        project_role: selectedRole || null
      });
      setSelectedUserId('');
      setSelectedRole('');
      fetchTeamData();
    } catch (e: any) {
      alert(`Failed to add member: ${e.message}`);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <Loader />
          <span className="text-on-surface-variant font-medium mt-4">Loading team...</span>
        </div>
      </AppShell>
    );
  }

  // Filter out people already added
  const availableOrgMembers = orgMembers.filter(om => 
    om.user_id && !projectMembers.some(pm => pm.user_id === om.user_id)
  );

  return (
    <AppShell>
      <div className="p-8 max-w-5xl">
        <h1 className="font-display-sm text-3xl font-bold mb-8 text-on-surface">Project Team</h1>

        <div className="bg-surface-container p-6 rounded-2xl shadow-sm border border-outline-variant/30 mb-8">
          <h2 className="font-headline-sm text-xl font-bold mb-4 text-on-surface">Add Org Member to Project</h2>
          <form onSubmit={handleAddMember} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-bold text-on-surface-variant mb-2">Select Member</label>
              <select 
                value={selectedUserId} 
                onChange={e => setSelectedUserId(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded p-2 text-on-surface focus:outline-none focus:border-primary"
                required
              >
                <option value="">-- Choose Member --</option>
                {availableOrgMembers.map(m => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.user_name || m.user_email} ({m.org_role})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex-1">
              <label className="block text-sm font-bold text-on-surface-variant mb-2">Project Role Override (Optional)</label>
              <select 
                value={selectedRole} 
                onChange={e => setSelectedRole(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded p-2 text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="">No Override (Use Org Role)</option>
                <option value="director">Director</option>
                <option value="assistant_director">Assistant Director</option>
                <option value="dop">DOP</option>
                <option value="editor">Editor</option>
                <option value="production_designer">Production Designer</option>
                <option value="cast">Cast</option>
                <option value="crew">Crew</option>
              </select>
            </div>
            
            <button 
              type="submit" 
              disabled={!selectedUserId}
              className="px-6 py-2 h-[42px] bg-primary text-on-primary rounded font-bold hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all"
            >
              Add to Project
            </button>
          </form>
        </div>

        <div className="bg-surface-container p-6 rounded-2xl shadow-sm border border-outline-variant/30">
          <h2 className="font-headline-sm text-xl font-bold mb-4 text-on-surface">Current Team Members</h2>
          
          {projectMembers.length === 0 ? (
            <p className="text-on-surface-variant">No members have been explicitly added to this project yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant/30">
                    <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Name / Email</th>
                    <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Org Role</th>
                    <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Project Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {projectMembers.map(member => (
                    <tr key={member.id} className="hover:bg-surface-variant/20 transition-colors">
                      <td className="py-3 px-4 text-sm font-medium text-on-surface">
                        {member.user_name} <br/>
                        <span className="text-xs text-on-surface-variant font-normal">{member.user_email}</span>
                      </td>
                      <td className="py-3 px-4 text-sm text-on-surface uppercase">{member.org_role}</td>
                      <td className="py-3 px-4 text-sm text-primary-container font-bold uppercase">
                        {member.project_role || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
