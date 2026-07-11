'use client';
import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { apiClient } from '@/lib/apiClient';

// Full 13-role permission map.
// Each entry lists the route prefixes this role can access.
const roleAccess: Record<string, string[]> = {
  // Org management layer — full access to all production routes
  'owner':             ['/projects', '/resources', '/locations', '/budget', '/analytics', '/organizations', '/reports'],
  'admin':             ['/projects', '/resources', '/locations', '/budget', '/analytics', '/organizations', '/reports'],
  'producer':          ['/projects', '/resources', '/locations', '/budget', '/analytics', '/organizations', '/reports'],
  'line_producer':     ['/projects', '/resources', '/locations', '/budget', '/analytics', '/organizations', '/reports'],

  // Creative leads — schedule + location + resources, no budget or analytics
  'director':          ['/projects', '/resources', '/locations'],
  'assistant_director':['/projects', '/resources', '/locations'],

  // DOP — schedule, locations, equipment (inside resources), no budget/analytics/cast management
  'dop':               ['/projects', '/resources', '/locations'],

  // Editor — view-only shooting schedule, no budget/analytics/editing capabilities
  'editor':            ['/projects'],

  // Designers — scenes and locations for continuity/setting, no budget/cast management
  'production_designer':['/projects', '/locations'],
  'costume_designer':   ['/projects', '/locations'],

  // Personal view only — they see My Schedule, nothing else
  'cast':   ['/my-schedule'],
  'crew':   ['/my-schedule'],
  'viewer': ['/my-schedule'],
};

// Super Admin gets their own isolated dashboard
const SUPER_ADMIN_ROUTE = '/admin';

// Maps legacy capitalized role strings to the normalized snake_case equivalents
const legacyRoleMap: Record<string, string> = {
  'Producer':            'producer',
  'Line Producer':       'line_producer',
  'Director':            'director',
  'Assistant Director':  'assistant_director',
  'DOP':                 'dop',
  'Editor':              'editor',
  'Production Designer': 'production_designer',
  'Costume Designer':    'costume_designer',
  'Cast':                'cast',
  'Crew':                'crew',
  'Viewer':              'viewer',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    apiClient.get('/api/auth/me').then(data => {
      if (data) {
        // Super Admin (global role == 'admin') gets their own isolated dashboard
        if (data.role === 'admin') {
          if (pathname === '/' || pathname === SUPER_ADMIN_ROUTE || pathname.startsWith(SUPER_ADMIN_ROUTE + '/')) {
            if (pathname === '/') router.push(SUPER_ADMIN_ROUTE);
            else setAuthorized(true);
          } else {
            router.push(SUPER_ADMIN_ROUTE);
          }
          return;
        }

        // Determine the effective org role for the active org context
        let effectiveRole = 'viewer';
        if (data.organizations && data.organizations.length > 0) {
          const activeOrgId = sessionStorage.getItem('active_org_id');
          const org = activeOrgId
            ? data.organizations.find((o: any) => o.org_id === activeOrgId)
            : data.organizations[0];

          if (org) {
            effectiveRole = org.org_role;
            if (!activeOrgId) sessionStorage.setItem('active_org_id', org.org_id);
          }
        } else if (data.role) {
          // Fallback to legacy capitalized role string
          effectiveRole = legacyRoleMap[data.role] || data.role.toLowerCase() || 'viewer';
        }

        const normalizedRole = effectiveRole.toLowerCase();
        const allowedPaths = roleAccess[normalizedRole] || ['/my-schedule'];
        const fallbackRoute = allowedPaths[0];

        // Root path — redirect to role's primary page
        if (pathname === '/') {
          router.push(fallbackRoute);
          return;
        }

        // Globally accessible utility pages (all authenticated roles can reach these)
        const globalPaths = ['/settings', '/support'];
        const isAllowed =
          globalPaths.some(p => pathname === p || pathname.startsWith(p + '/')) ||
          allowedPaths.some(p => pathname === p || pathname.startsWith(p + '/'));

        if (isAllowed) {
          setAuthorized(true);
        } else {
          router.push(fallbackRoute);
        }
      }
    }).catch(err => {
      console.error(err);
      router.push('/login');
    });
  }, [pathname, router]);

  if (authorized === null) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-on-surface-variant">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Sidebar />
      <div className="flex flex-col min-h-screen">
        <TopBar />
        <main className="flex-1 pl-[280px] p-margin-safe max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
