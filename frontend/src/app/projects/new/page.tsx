'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/apiClient';

export default function NewProjectWizard() {
  const router = useRouter();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Step 1: Project Details
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  // Step 2: Upload
  const [file, setFile] = useState<File | null>(null);
  
  // Step 3: Review
  const [parsedData, setParsedData] = useState<{ scenes: any[], cast_members: any[], equipment: any[] } | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  // Cast member draft records — returned after commit (no accounts yet)
  const [castDrafts, setCastDrafts] = useState<any[]>([]);
  const [showAccountsStep, setShowAccountsStep] = useState(false);

  // Per-person invite state: castId -> { email: string, inviting: bool, token: string | null, done: bool }
  const [inviteState, setInviteState] = useState<Record<string, { email: string; inviting: boolean; token: string | null; done: boolean }>>({});

  const handleCreateProject = async () => {
    if (!name.trim() || loading) return;
    setLoading(true);
    try {
      // Find active org id from sessionStorage
      const orgId = sessionStorage.getItem('active_org_id');
      
      const proj = await apiClient.post('/api/projects', {
        name,
        description,
        org_id: orgId
      });
      setProjectId(proj.id);
      
      // If no file, just redirect to project
      if (!file) {
        router.push(`/projects/${proj.id}`);
        return;
      }
      
      // If file, parse script
      const formData = new FormData();
      formData.append('file', file);
      
      const extraction = await apiClient.post(`/api/projects/${proj.id}/script/parse`, formData);
      
      setParsedData(extraction);
      setStep(3);
    } catch (err) {
      console.error(err);
      alert("Error creating project or parsing script. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCommitScript = async () => {
    if (!projectId || !parsedData) return;
    setLoading(true);
    try {
      const res = await apiClient.post(`/api/projects/${projectId}/script/commit`, parsedData);
      if (res && res.cast_members && res.cast_members.length > 0) {
        // cast_members are draft records — no accounts yet, admin invites each person individually
        setCastDrafts(res.cast_members);
        // Pre-populate invite state with empty email fields
        const initState: Record<string, any> = {};
        res.cast_members.forEach((cm: any) => {
          initState[cm.id] = { email: '', inviting: false, token: null, done: false };
        });
        setInviteState(initState);
        setShowAccountsStep(true);
      } else {
        router.push(`/projects/${projectId}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error committing script data.');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteCast = async (castId: string) => {
    const state = inviteState[castId];
    if (!state || !state.email.trim() || state.inviting || state.done) return;
    setInviteState(prev => ({ ...prev, [castId]: { ...prev[castId], inviting: true } }));
    try {
      const res = await apiClient.post(
        `/api/projects/${projectId}/cast/${castId}/invite?email=${encodeURIComponent(state.email)}`,
        {}
      );
      setInviteState(prev => ({
        ...prev,
        [castId]: {
          ...prev[castId],
          inviting: false,
          token: res.invite_token || null,
          done: true,
        },
      }));
    } catch (err: any) {
      alert(err.message || 'Failed to send invite');
      setInviteState(prev => ({ ...prev, [castId]: { ...prev[castId], inviting: false } }));
    }
  };

  return (
    <AppShell>
      <div className="py-stack-md max-w-4xl mx-auto animate-in fade-in duration-500">
        
        <div className="mb-stack-lg">
          <h1 className="font-headline-lg text-[32px] font-bold text-on-surface">New Project Setup</h1>
          <p className="text-on-surface-variant font-body-lg">
            {showAccountsStep ? "Review cast access — grant invites as needed." : (
              <>
                {step === 1 && "Start by naming your production."}
                {step === 2 && "Upload your screenplay. Our AI will automatically break down scenes, cast, and locations."}
                {step === 3 && "Review the AI extraction before finalizing."}
              </>
            )}
          </p>
        </div>

        <div className="flex gap-4 mb-8">
          <div className={`h-2 flex-1 rounded-full ${showAccountsStep || step >= 1 ? 'bg-primary-container' : 'bg-surface-variant'}`} />
          <div className={`h-2 flex-1 rounded-full ${showAccountsStep || step >= 2 ? 'bg-primary-container' : 'bg-surface-variant'}`} />
          <div className={`h-2 flex-1 rounded-full ${showAccountsStep || step >= 3 ? 'bg-primary-container' : 'bg-surface-variant'}`} />
        </div>

        {showAccountsStep ? (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="font-headline-md text-[20px] text-primary-container flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[24px]">group_add</span>
                Grant Access to Cast Members
              </h2>
              <p className="text-sm text-on-surface-variant mb-1">
                The script has been processed. Cast members are stored as scheduling constraints but have no login access yet.
              </p>
              <p className="text-xs text-on-surface-variant/60 mb-6">
                {/* Phase 5 (email dispatch) will auto-send invite tokens here. Until then, enter each
                    person's email, click Generate Invite, and share the unique one-time token manually.
                    Each token is unique — never a shared password across accounts. */}
                For each cast member you want to grant app access, enter their email and click <strong>Generate Invite</strong>. Share the one-time token shown. You can skip anyone and invite them later from Settings.
              </p>

              <div className="space-y-3">
                {castDrafts.map((cm: any) => {
                  const state = inviteState[cm.id] || { email: '', inviting: false, token: null, done: false };
                  return (
                    <div key={cm.id} className="bg-surface-container border border-outline-variant rounded p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-on-surface-variant text-[16px]">person</span>
                            <span className="font-bold text-on-surface text-sm">{cm.name}</span>
                            {cm.role && <span className="text-xs text-on-surface-variant capitalize bg-surface-variant px-2 py-0.5 rounded">{cm.role}</span>}
                          </div>

                          {state.done ? (
                            // Show generated token (once only)
                            <div className="mt-2">
                              {state.token ? (
                                <div className="p-2 bg-primary-container/10 border border-primary-container/20 rounded">
                                  <p className="text-xs text-on-surface-variant mb-1">Invite token (share this, shown once):</p>
                                  <code className="text-primary-container font-mono text-sm font-bold select-all">{state.token}</code>
                                  <p className="text-xs text-on-surface-variant/60 mt-1">Login: {state.email} · Token expires on first use (they set their own password).</p>
                                </div>
                              ) : (
                                <p className="text-xs text-green-400">Linked to existing account — they log in with their current password.</p>
                              )}
                            </div>
                          ) : (
                            <div className="flex gap-2 mt-2">
                              <input
                                type="email"
                                value={state.email}
                                onChange={e => setInviteState(prev => ({ ...prev, [cm.id]: { ...prev[cm.id], email: e.target.value } }))}
                                placeholder={`${cm.name.toLowerCase().replace(/\s+/g, '.')}@studio.com`}
                                className="flex-1 bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:border-primary-container outline-none"
                              />
                              <button
                                disabled={!state.email.trim() || state.inviting}
                                onClick={() => handleInviteCast(cm.id)}
                                className="px-3 py-2 bg-primary-container text-on-primary-fixed-variant text-xs font-bold rounded hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1 flex-shrink-0"
                              >
                                {state.inviting
                                  ? <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                                  : <span className="material-symbols-outlined text-[14px]">send</span>}
                                {state.inviting ? 'Sending...' : 'Generate Invite'}
                              </button>
                            </div>
                          )}
                        </div>

                        {state.done && (
                          <span className="material-symbols-outlined text-green-400 text-[22px] flex-shrink-0 mt-1">check_circle</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-6">
                <button
                  onClick={() => router.push(`/projects/${projectId}`)}
                  className="bg-primary-container text-on-primary-fixed-variant px-6 py-2.5 rounded font-bold shadow hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
                >
                  Go to Project Dashboard
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </Card>
          </div>
        ) : (
          <>
            {step === 1 && (
          <Card className="p-8 space-y-6">
            <h2 className="font-headline-md text-on-surface">Project Details</h2>
            <Input 
              label="Project Name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g. Star Wars: Episode IV"
            />
            <Input 
              label="Description (Optional)" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
            />
            <div className="flex justify-end pt-4">
              <button 
                className="bg-primary-container text-on-primary-fixed-variant px-6 py-2 rounded font-bold shadow disabled:opacity-50"
                disabled={!name.trim()}
                onClick={() => setStep(2)}
              >
                Continue to Script Upload
              </button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card className="p-8 space-y-6">
            <h2 className="font-headline-md text-on-surface">Upload Screenplay</h2>
            
            <div className="border-2 border-dashed border-outline-variant rounded-lg p-12 text-center hover:bg-surface-container-low transition-colors">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-4">upload_file</span>
              <p className="font-body-lg text-on-surface mb-2">Drag and drop your script (PDF or TXT) here</p>
              <input 
                type="file" 
                accept=".pdf,.txt"
                className="mx-auto block text-on-surface-variant"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            
            <div className="flex justify-between pt-4">
              <button 
                className="text-on-surface-variant hover:text-on-surface px-4 py-2 font-bold"
                onClick={() => setStep(1)}
              >
                Back
              </button>
              
              <button 
                className="bg-primary-container text-on-primary-fixed-variant px-6 py-2 rounded font-bold shadow disabled:opacity-50 flex items-center gap-2"
                onClick={handleCreateProject}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin">sync</span>
                    Processing Script...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">auto_awesome</span>
                    Extract Setup from Script
                  </>
                )}
              </button>
            </div>
            
            {!loading && (
              <div className="text-center pt-2">
                <button 
                  className="text-primary-container underline text-sm"
                  onClick={() => {
                    setFile(null);
                    handleCreateProject();
                  }}
                >
                  Skip script upload (manual setup)
                </button>
              </div>
            )}
          </Card>
        )}

        {step === 3 && parsedData && (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="font-headline-md text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-container">groups</span>
                Extracted Cast ({parsedData.cast_members.length})
              </h2>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar border border-outline-variant/30 rounded">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container sticky top-0">
                    <tr>
                      <th className="p-3 text-on-surface-variant font-label-md uppercase w-1/2">Character / Name</th>
                      <th className="p-3 text-on-surface-variant font-label-md uppercase w-1/2">Role / Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {parsedData.cast_members.map((c, i) => (
                      <tr key={i} className="hover:bg-surface-container-low transition-colors">
                        <td className="p-2">
                          <input 
                            className="w-full bg-transparent font-bold outline-none border-b border-transparent focus:border-primary px-2 py-1 placeholder-on-surface-variant/50" 
                            value={c.name} 
                            onChange={e => {
                              const newData = {...parsedData};
                              newData.cast_members[i].name = e.target.value;
                              setParsedData(newData);
                            }} 
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            className="w-full bg-transparent opacity-80 outline-none border-b border-transparent focus:border-primary px-2 py-1 placeholder-on-surface-variant/50" 
                            value={c.role} 
                            onChange={e => {
                              const newData = {...parsedData};
                              newData.cast_members[i].role = e.target.value;
                              setParsedData(newData);
                            }} 
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Extracted Equipment */}
            <Card className="p-6">
              <h2 className="font-headline-md text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-container">camera</span>
                Extracted Equipment ({parsedData.equipment?.length || 0})
              </h2>
              <div className="max-h-[250px] overflow-y-auto custom-scrollbar border border-outline-variant/30 rounded">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container sticky top-0">
                    <tr>
                      <th className="p-3 text-on-surface-variant font-label-md uppercase w-1/3">Name</th>
                      <th className="p-3 text-on-surface-variant font-label-md uppercase w-1/3">Quantity</th>
                      <th className="p-3 text-on-surface-variant font-label-md uppercase w-1/3">Cost / Day ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {(parsedData.equipment || []).map((eq, i) => (
                      <tr key={i} className="hover:bg-surface-container-low transition-colors">
                        <td className="p-2">
                          <input 
                            className="w-full bg-transparent font-bold outline-none border-b border-transparent focus:border-primary px-2 py-1" 
                            value={eq.name} 
                            onChange={e => {
                              const newData = {...parsedData};
                              newData.equipment[i].name = e.target.value;
                              setParsedData(newData);
                            }} 
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="number"
                            className="w-full bg-transparent opacity-80 outline-none border-b border-transparent focus:border-primary px-2 py-1" 
                            value={eq.quantity} 
                            onChange={e => {
                              const newData = {...parsedData};
                              newData.equipment[i].quantity = parseInt(e.target.value) || 1;
                              setParsedData(newData);
                            }} 
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="number"
                            className="w-full bg-transparent opacity-80 outline-none border-b border-transparent focus:border-primary px-2 py-1" 
                            value={eq.cost_per_day} 
                            onChange={e => {
                              const newData = {...parsedData};
                              newData.equipment[i].cost_per_day = parseFloat(e.target.value) || 0;
                              setParsedData(newData);
                            }} 
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="font-headline-md text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-container">movie</span>
                Extracted Scenes ({parsedData.scenes.length})
              </h2>
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar border border-outline-variant/30 rounded">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container sticky top-0">
                    <tr>
                      <th className="p-3 text-on-surface-variant font-label-md uppercase">#</th>
                      <th className="p-3 text-on-surface-variant font-label-md uppercase">Setting</th>
                      <th className="p-3 text-on-surface-variant font-label-md uppercase">Location</th>
                      <th className="p-3 text-on-surface-variant font-label-md uppercase">Title</th>
                      <th className="p-3 text-on-surface-variant font-label-md uppercase">Cast</th>
                      <th className="p-3 text-on-surface-variant font-label-md uppercase">Equipment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {parsedData.scenes.map((s, i) => (
                      <tr key={i} className="hover:bg-surface-container-low transition-colors">
                        <td className="p-2">
                          <input 
                            type="number" 
                            className="w-12 bg-transparent outline-none border-b border-transparent focus:border-primary font-mono-data" 
                            value={s.scene_number} 
                            onChange={e => {
                              const newData = {...parsedData};
                              newData.scenes[i].scene_number = parseInt(e.target.value) || 0;
                              setParsedData(newData);
                            }}
                          />
                        </td>
                        <td className="p-2 flex items-center gap-1">
                          <input 
                            className="w-12 bg-transparent outline-none border-b border-transparent focus:border-primary font-label-md" 
                            value={s.setting} 
                            onChange={e => {
                              const newData = {...parsedData};
                              newData.scenes[i].setting = e.target.value;
                              setParsedData(newData);
                            }}
                          />
                          / 
                          <input 
                            className="w-16 bg-transparent outline-none border-b border-transparent focus:border-primary font-label-md" 
                            value={s.time_of_day} 
                            onChange={e => {
                              const newData = {...parsedData};
                              newData.scenes[i].time_of_day = e.target.value;
                              setParsedData(newData);
                            }}
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            className="w-32 bg-transparent outline-none border-b border-transparent focus:border-primary" 
                            value={s.location_name} 
                            onChange={e => {
                              const newData = {...parsedData};
                              newData.scenes[i].location_name = e.target.value;
                              setParsedData(newData);
                            }}
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            className="w-48 bg-transparent outline-none border-b border-transparent focus:border-primary font-bold" 
                            value={s.title} 
                            onChange={e => {
                              const newData = {...parsedData};
                              newData.scenes[i].title = e.target.value;
                              setParsedData(newData);
                            }}
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            className="w-full min-w-[150px] bg-transparent outline-none border-b border-transparent focus:border-primary text-sm opacity-80" 
                            value={s.cast_names.join(', ')} 
                            onChange={e => {
                              const newData = {...parsedData};
                              newData.scenes[i].cast_names = e.target.value.split(',').map(n => n.trim()).filter(Boolean);
                              setParsedData(newData);
                            }}
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            className="w-full min-w-[150px] bg-transparent outline-none border-b border-transparent focus:border-primary text-sm opacity-80" 
                            value={(s.equipment_names || []).join(', ')} 
                            onChange={e => {
                              const newData = {...parsedData};
                              newData.scenes[i].equipment_names = e.target.value.split(',').map(n => n.trim()).filter(Boolean);
                              setParsedData(newData);
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            
            <div className="flex justify-end pt-4 gap-4">
              <button 
                className="text-error hover:bg-error/10 px-6 py-2 rounded font-bold"
                onClick={async () => {
                  if (projectId) {
                    setLoading(true);
                    try {
                      await apiClient.delete(`/api/projects/${projectId}`);
                    } catch (e) {
                      console.error("Failed to delete project on discard:", e);
                    } finally {
                      setLoading(false);
                    }
                  }
                  router.push('/projects');
                }}
                disabled={loading}
              >
                Discard Breakdown
              </button>
              <button 
                className="bg-primary-container text-on-primary-fixed-variant px-6 py-2 rounded font-bold shadow disabled:opacity-50"
                onClick={handleCommitScript}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Confirm & Save to Project'}
              </button>
            </div>
          </div>
        )}
        </>
      )}
      </div>
    </AppShell>
  );
}
