'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { apiClient } from '@/lib/apiClient';
import { useParams } from 'next/navigation';

export default function OrgSettingsPage() {
  const { id } = useParams() as { id: string };
  const [org, setOrg] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Invite State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<{email: string, password?: string, role: string} | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [orgData, membersData] = await Promise.all([
        apiClient.get(`/api/organizations/${id}`),
        apiClient.get(`/api/organizations/${id}/members`)
      ]);
      setOrg(orgData);
      setMembers(membersData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setGeneratedCredentials(null);
    try {
      const res = await apiClient.post(`/api/organizations/${id}/members/invite`, {
        email: inviteEmail,
        role: inviteRole
      });
      setInviteModalOpen(false);
      setInviteEmail('');
      setInviteRole('viewer');
      if (res) {
        setGeneratedCredentials({
          email: res.user_email,
          password: res.default_password,
          role: res.org_role
        });
      }
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm('Remove this member?')) return;
    try {
      await apiClient.delete(`/api/organizations/${id}/members/${memberId}`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <AppShell><div className="p-8 text-on-surface-variant">Loading Settings...</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="py-stack-md animate-in fade-in duration-500 flex flex-col min-h-0 h-[calc(100vh-64px)] overflow-hidden">
        
        <div className="flex justify-between items-end pb-4 mb-stack-md border-b border-outline-variant/30 flex-shrink-0">
          <div>
            <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">{org?.name} Settings</h1>
            <p className="text-on-surface-variant font-body-md mt-1">Manage your production house and team roster.</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-8 space-y-6">
          {generatedCredentials && (
            <Card className="p-4 border-primary-container/30 bg-primary-container/5 relative animate-in slide-in-from-top duration-300">
              <button
                onClick={() => setGeneratedCredentials(null)}
                className="absolute top-3 right-3 text-on-surface-variant hover:text-on-surface p-1"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
              <h3 className="font-headline-sm text-sm font-bold text-primary-container flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                Member Added Successfully!
              </h3>
              <p className="text-xs text-on-surface-variant mb-3">
                {generatedCredentials.password
                  ? 'A new account has been provisioned. Share the unique one-time invite token below — it is shown only once and cannot be recovered. The member must set their own password on first login.'
                  : 'This email already had an account. The member can log in with their existing password.'}
              </p>
              <div className="bg-surface-container border border-outline-variant/30 rounded p-3 text-xs space-y-2 font-mono">
                <div><span className="text-on-surface-variant">Email:</span> <strong className="text-on-surface font-bold">{generatedCredentials.email}</strong></div>
                {generatedCredentials.password ? (
                  <>
                    <div><span className="text-on-surface-variant">Invite Token:</span> <strong className="text-primary-container font-bold select-all">{generatedCredentials.password}</strong></div>
                    <div className="text-on-surface-variant/60 italic">This token is unique to this person. Once they log in and set a new password, this token is invalidated.</div>
                  </>
                ) : (
                  <div className="text-on-surface-variant italic">Uses their existing account password</div>
                )}
                <div><span className="text-on-surface-variant">Role Scope:</span> <span className="text-primary capitalize">{generatedCredentials.role}</span></div>
              </div>
            </Card>
          )}

          <Card className="p-6">
            <h2 className="font-headline-md text-[18px] text-on-surface mb-4">Team Roster</h2>
            
            <div className="flex justify-end mb-4">
              <button onClick={() => setInviteModalOpen(true)} className="flex items-center gap-2 bg-primary-container text-on-primary-fixed-variant px-4 py-2 rounded font-label-md uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all">
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                Invite Member
              </button>
            </div>

            <div className="bg-surface-container border border-outline-variant rounded overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-container-low border-b border-outline-variant/50">
                  <tr>
                    <th className="px-4 py-3 font-label-md uppercase text-on-surface-variant">Name</th>
                    <th className="px-4 py-3 font-label-md uppercase text-on-surface-variant">Email</th>
                    <th className="px-4 py-3 font-label-md uppercase text-on-surface-variant">Role</th>
                    <th className="px-4 py-3 font-label-md uppercase text-on-surface-variant">Status</th>
                    <th className="px-4 py-3 font-label-md uppercase text-on-surface-variant text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {members.map(m => (
                    <tr key={m.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-on-surface">{m.user_name}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{m.user_email}</td>
                      <td className="px-4 py-3 text-on-surface-variant capitalize">{m.org_role.replace('_', ' ')}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded uppercase font-bold ${m.status === 'active' ? 'bg-primary-container/20 text-primary-container' : 'bg-outline-variant/20 text-on-surface-variant'}`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {m.org_role !== 'owner' && (
                          <button onClick={() => handleRemove(m.id)} className="text-error hover:text-error/80 transition-colors">
                            <span className="material-symbols-outlined text-[20px]">person_remove</span>
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

        {/* Invite Modal */}
        <Modal 
          isOpen={inviteModalOpen} 
          onClose={() => setInviteModalOpen(false)} 
          title="Invite Team Member"
          footer={
            <>
              <button onClick={() => setInviteModalOpen(false)} className="px-4 py-2 font-label-md uppercase hover:bg-surface-variant rounded transition-colors text-on-surface-variant">Cancel</button>
              <button onClick={handleInvite} disabled={inviting} className="px-4 py-2 bg-primary-container text-on-primary-fixed-variant font-bold font-label-md uppercase rounded hover:brightness-110 active:scale-95 transition-all">
                {inviting ? 'Inviting...' : 'Send Invite'}
              </button>
            </>
          }
        >
          <form className="space-y-4" onSubmit={handleInvite}>
            <Input label="Email Address" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
            <div className="space-y-1">
              <label className="font-label-md uppercase text-on-surface-variant text-[11px] block">Role</label>
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="w-full bg-surface-container border border-outline-variant rounded p-3 text-sm text-on-surface focus:border-primary-container outline-none appearance-none">
                <option value="admin">Admin</option>
                <option value="producer">Producer</option>
                <option value="director">Director</option>
                <option value="assistant_director">Assistant Director</option>
                <option value="dop">DOP</option>
                <option value="editor">Editor</option>
                <option value="production_designer">Production Designer</option>
                <option value="cast">Cast</option>
                <option value="crew">Crew</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </form>
        </Modal>

      </div>
    </AppShell>
  );
}
