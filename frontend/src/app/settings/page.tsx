'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/apiClient';

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>({ name: '', email: '', role: '' });
  const [org, setOrg] = useState<any>({ name: '' });
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);

  // Preference Mocks
  const [theme, setTheme] = useState('dark');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const profileData = await apiClient.get('/api/auth/me');
        if (profileData) {
          setProfile({
            name: profileData.name || '',
            email: profileData.email || '',
            role: profileData.role || 'Viewer'
          });

          // Fetch organization name
          const activeOrgId = localStorage.getItem('active_org_id');
          if (activeOrgId && profileData.organizations) {
            const currentOrg = profileData.organizations.find((o: any) => o.org_id === activeOrgId);
            if (currentOrg) {
              setOrg({ name: currentOrg.org_name || '' });
            }
          }
        }
      } catch (err) {
        console.error("Error loading settings:", err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      // Mock save profile
      await new Promise(resolve => setTimeout(resolve, 800));
      alert('Profile details updated successfully (simulation).');
    } catch (err) {
      console.error(err);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOrg(true);
    try {
      // Mock save organization name
      await new Promise(resolve => setTimeout(resolve, 800));
      alert('Organization name updated successfully (simulation).');
    } catch (err) {
      console.error(err);
    } finally {
      setSavingOrg(false);
    }
  };

  return (
    <AppShell>
      <div className="py-stack-md max-w-4xl mx-auto animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="pb-4 mb-stack-md border-b border-outline-variant/30">
          <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">Settings</h1>
          <p className="text-on-surface-variant font-body-md mt-1 font-sans">Manage your user profile, active organization preferences, and client toggles.</p>
        </div>

        {loading ? (
          <div className="text-on-surface-variant italic py-12 text-center">Loading settings data...</div>
        ) : (
          <div className="space-y-6">
            
            {/* User Profile Settings */}
            <Card className="p-6 bg-surface-container-low border border-outline-variant/30">
              <h3 className="font-headline-md text-[18px] text-on-surface mb-4 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
                <span className="material-symbols-outlined text-primary-container">person</span>
                User Profile
              </h3>
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input 
                    label="Display Name" 
                    value={profile.name} 
                    onChange={e => setProfile({ ...profile, name: e.target.value })} 
                    required 
                  />
                  <Input 
                    label="Email Address" 
                    type="email" 
                    value={profile.email} 
                    onChange={e => setProfile({ ...profile, email: e.target.value })} 
                    required 
                    disabled 
                  />
                </div>
                <div>
                  <label className="text-[12px] font-label-md uppercase tracking-wider text-on-surface-variant mb-1.5 block">Effective System Role</label>
                  <input 
                    type="text" 
                    value={profile.role} 
                    disabled 
                    className="w-full bg-surface-container/50 border border-outline-variant/30 rounded px-3 py-2 text-sm text-on-surface-variant/80 font-mono-data cursor-not-allowed" 
                  />
                  <span className="text-[11px] text-on-surface-variant/70 mt-1 block font-sans">Role changes must be approved and executed by organization administrators.</span>
                </div>
                <div className="flex justify-end pt-2">
                  <button 
                    type="submit" 
                    disabled={savingProfile} 
                    className="px-6 py-2 bg-primary-container text-on-primary-fixed-variant font-bold font-label-md uppercase rounded shadow hover:brightness-110 active:scale-95 transition-all"
                  >
                    {savingProfile ? 'Saving Details...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </Card>

            {/* Active Organization Settings */}
            <Card className="p-6 bg-surface-container-low border border-outline-variant/30">
              <h3 className="font-headline-md text-[18px] text-on-surface mb-4 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
                <span className="material-symbols-outlined text-primary-container">domain</span>
                Active Organization
              </h3>
              <form onSubmit={handleOrgSubmit} className="space-y-4">
                <Input 
                  label="Organization Name" 
                  value={org.name} 
                  onChange={e => setOrg({ ...org, name: e.target.value })} 
                  required 
                />
                <div className="flex justify-end pt-2">
                  <button 
                    type="submit" 
                    disabled={savingOrg} 
                    className="px-6 py-2 bg-primary-container text-on-primary-fixed-variant font-bold font-label-md uppercase rounded shadow hover:brightness-110 active:scale-95 transition-all"
                  >
                    {savingOrg ? 'Updating Org...' : 'Update Org Name'}
                  </button>
                </div>
              </form>
            </Card>

            {/* Application Preferences */}
            <Card className="p-6 bg-surface-container-low border border-outline-variant/30">
              <h3 className="font-headline-md text-[18px] text-on-surface mb-4 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
                <span className="material-symbols-outlined text-primary-container">settings_suggest</span>
                Client Preferences
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2">
                  <div>
                    <h5 className="font-bold text-sm text-on-surface">Application UI Theme</h5>
                    <p className="text-xs text-on-surface-variant">Switch application aesthetics between Dark and Light.</p>
                  </div>
                  <select 
                    value={theme} 
                    onChange={e => setTheme(e.target.value)}
                    className="bg-surface-container border border-outline-variant rounded px-3 py-1.5 text-sm text-on-surface focus:border-primary-container focus:outline-none"
                  >
                    <option value="dark">Dark Theme (Standard)</option>
                    <option value="light">Light Theme</option>
                  </select>
                </div>

                <div className="flex justify-between items-center py-2 border-t border-outline-variant/10">
                  <div>
                    <h5 className="font-bold text-sm text-on-surface">Enable Desktop Notifications</h5>
                    <p className="text-xs text-on-surface-variant">Display push alerts when schedules are generated or updated.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={notificationsEnabled} 
                      onChange={e => setNotificationsEnabled(e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-surface-container border border-outline-variant rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-on-surface-variant after:border-outline-variant after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container peer-checked:after:bg-on-primary-fixed-variant"></div>
                  </label>
                </div>
              </div>
            </Card>

          </div>
        )}
      </div>
    </AppShell>
  );
}
