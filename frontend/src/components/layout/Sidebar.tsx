'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [activeOrgName, setActiveOrgName] = useState<string>('A2 Productions');

  // Helper function to extract projectId synchronously on client
  const getInitialProjectId = () => {
    if (typeof window === 'undefined') return null;
    const pathSegments = window.location.pathname.split('/');
    const isProjectPath = pathSegments[1] === 'projects' && pathSegments[2] && pathSegments[2] !== 'new';
    if (isProjectPath) return pathSegments[2];
    
    const params = new URLSearchParams(window.location.search);
    return params.get('projectId');
  };

  const [projectId, setProjectId] = useState<string | null>(getInitialProjectId);
  const isProjectContext = !!projectId;

  const [user, setUser] = useState<any>(null);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

  useEffect(() => {
    // Update projectId when pathname or search parameters change
    const pathSegments = window.location.pathname.split('/');
    const isProjectPath = pathSegments[1] === 'projects' && pathSegments[2] && pathSegments[2] !== 'new';
    let pId = isProjectPath ? pathSegments[2] : null;
    
    if (!pId && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      pId = params.get('projectId');
    }
    setProjectId(pId);
  }, [pathname]);

  useEffect(() => {
    apiClient.get('/api/auth/me').then(data => {
      if (data) {
        setUser(data);
        if (data.role) {
          setUserRole(data.role);
        }
        const savedOrg = sessionStorage.getItem('active_org_id');
        const orgs = data.organizations || [];
        if (orgs.length > 0) {
          const org = savedOrg && orgs.find((o: any) => o.org_id === savedOrg)
            ? orgs.find((o: any) => o.org_id === savedOrg)
            : orgs[0];
          if (org) {
            setActiveOrgId(org.org_id);
            setActiveOrgName(org.org_name);
            if (!savedOrg) {
              sessionStorage.setItem('active_org_id', org.org_id);
            }
          }
        }
      }
    }).catch(err => console.error(err));
  }, []);

  const handleOrgChange = (orgId: string) => {
    setActiveOrgId(orgId);
    sessionStorage.setItem('active_org_id', orgId);
    window.location.reload();
  };

  useEffect(() => {
    if (projectId) {
      apiClient.get(`/api/projects/${projectId}`)
        .then(data => {
          if (data && data.name) {
            setProjectName(data.name);
          }
        })
        .catch(err => console.error("Error fetching project details for sidebar:", err));
    } else {
      setProjectName('');
    }
  }, [projectId]);

  // Project-scoped navigation items
  const projectNavItems = [
    { label: 'Constraints Editor', icon: 'edit_note', href: `/projects/${projectId}` },
    { label: 'Master Schedule', icon: 'calendar_month', href: `/projects/${projectId}/schedule` },
    { label: 'Resource Manager', icon: 'people', href: `/resources?projectId=${projectId}` },
    { label: 'Locations', icon: 'location_on', href: `/locations?projectId=${projectId}` },
    { label: 'Budget Monitor', icon: 'attach_money', href: `/budget?projectId=${projectId}` },
    { label: 'Analytics', icon: 'monitoring', href: `/analytics?projectId=${projectId}` },
    { label: 'Reports', icon: 'description', href: `/reports?projectId=${projectId}` },
  ];

  // Global navigation items (when outside a project)
  const globalNavItems = [
    { label: 'Production Portfolio', icon: 'folder', href: '/projects' },
  ];

  const handleAddSceneClick = () => {
    if (!projectId) return;
    if (pathname === `/projects/${projectId}`) {
      window.dispatchEvent(new CustomEvent('open-add-scene'));
    } else {
      router.push(`/projects/${projectId}?addScene=true`);
    }
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-[280px] bg-background border-r border-outline-variant/30 flex flex-col z-30">
      {/* Logo/Brand Area */}
      <div className="h-16 flex flex-col justify-center px-6 border-b border-outline-variant/30 flex-shrink-0">
        <span className="text-[10px] font-label-md uppercase tracking-widest text-primary font-bold mb-0.5 truncate" title={activeOrgName}>
          {activeOrgName}
        </span>
        <div className="flex items-center">
          <div className="w-5 h-5 flex items-center justify-center bg-surface-container-low rounded border border-outline-variant shadow-sm mr-2 flex-shrink-0">
            <span className="material-symbols-outlined text-primary-container text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>theaters</span>
          </div>
          <span className="font-headline-md text-[14px] text-on-surface tracking-tight font-bold uppercase">CineSched</span>
        </div>
      </div>

      {/* Active Project Title (if in project context) */}
      {isProjectContext && (
        <div className="px-6 py-3 bg-surface-container-low/50 border-b border-outline-variant/20 flex flex-col gap-0.5">
          <span className="text-[10px] font-label-md uppercase tracking-wider text-on-surface-variant/70">Active Project</span>
          <span className="font-headline-sm text-sm font-bold text-primary-container truncate" title={projectName}>
            {projectName || 'Loading...'}
          </span>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto custom-scrollbar">
        {isProjectContext ? (
          <>
            {/* Back to Portfolio Button */}
            <Link 
              href="/projects" 
              className="flex items-center gap-3 px-3 py-2 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40 transition-colors mb-4 border border-outline-variant/20 bg-surface-container-low/30"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span className="font-label-md text-[12px] tracking-wide uppercase">All Projects</span>
            </Link>

            {projectNavItems.map((item, i) => {
              // Path matches exactly or is a sub-path
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href.split('?')[0]));
              
              return (
                <Link 
                  key={i} 
                  href={item.href} 
                  className={`flex items-center gap-3 px-3 py-2 rounded transition-colors group ${
                    isActive 
                      ? 'bg-primary-container/10 text-primary-container font-bold' 
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[20px] transition-colors ${isActive ? 'text-primary-container' : 'group-hover:text-primary-container'}`}>{item.icon}</span>
                  <span className="font-label-md text-[13px] tracking-wide uppercase">{item.label}</span>
                </Link>
              );
            })}
          </>
        ) : (
          globalNavItems.map((item, i) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={i} 
                href={item.href} 
                className={`flex items-center gap-3 px-3 py-2 rounded transition-colors group ${
                  isActive 
                    ? 'bg-primary-container/10 text-primary-container font-bold' 
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40'
                }`}
              >
                <span className={`material-symbols-outlined text-[20px] transition-colors ${isActive ? 'text-primary-container' : 'group-hover:text-primary-container'}`}>{item.icon}</span>
                <span className="font-label-md text-[13px] tracking-wide uppercase">{item.label}</span>
              </Link>
            );
          })
        )}
      </nav>

      {/* Action Button (Only inside project context) */}
      {isProjectContext && (
        <div className="px-6 py-4 flex-shrink-0">
          <button 
            onClick={handleAddSceneClick}
            className="w-full flex items-center justify-center gap-2 bg-primary-container text-on-primary-fixed-variant hover:brightness-110 active:scale-[0.99] font-label-md text-[13px] uppercase tracking-wider py-2.5 rounded transition-all duration-200 font-bold shadow-lg shadow-primary-container/10"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Scene
          </button>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="px-3 py-4 border-t border-outline-variant/30 space-y-1 flex-shrink-0">
        <Link href="/settings" className={`flex items-center gap-3 px-3 py-2 rounded transition-colors ${pathname === '/settings' ? 'bg-surface-variant/60 text-on-surface' : 'text-on-surface-variant/70 hover:text-on-surface hover:bg-surface-variant/40'}`}>
          <span className="material-symbols-outlined text-[18px]">settings</span>
          <span className="font-label-md text-[12px] tracking-wide uppercase">Settings</span>
        </Link>
        <Link href="/support" className={`flex items-center gap-3 px-3 py-2 rounded transition-colors ${pathname === '/support' ? 'bg-surface-variant/60 text-on-surface' : 'text-on-surface-variant/70 hover:text-on-surface hover:bg-surface-variant/40'}`}>
          <span className="material-symbols-outlined text-[18px]">help</span>
          <span className="font-label-md text-[12px] tracking-wide uppercase">Support</span>
        </Link>
      </div>
    </aside>
  );
}
