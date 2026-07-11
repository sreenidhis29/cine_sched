import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';

export function TopBar() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const markAllRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem('cine_notifications', JSON.stringify(updated));
      return updated;
    });
  };

  const hasUnread = notifications.some(n => !n.read);

  useEffect(() => {
    const loadNotifications = () => {
      const stored = localStorage.getItem('cine_notifications');
      if (stored) {
        setNotifications(JSON.parse(stored));
      } else {
        const initial = [
          { id: '1', title: 'System Initialized', message: 'A2 Productions scheduling workspace ready.', read: false, time: 'Just now' },
          { id: '2', title: 'Script Parser Loaded', message: 'Script breakdown models are ready for extraction.', read: true, time: '1 hour ago' }
        ];
        localStorage.setItem('cine_notifications', JSON.stringify(initial));
        setNotifications(initial);
      }
    };

    loadNotifications();

    const handleNewNotification = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setNotifications(prev => {
          const updated = [
            {
              id: Date.now().toString(),
              title: detail.title,
              message: detail.message,
              read: false,
              time: 'Just now'
            },
            ...prev
          ].slice(0, 50);
          localStorage.setItem('cine_notifications', JSON.stringify(updated));
          return updated;
        });
      }
    };

    window.addEventListener('new-notification', handleNewNotification);
    return () => window.removeEventListener('new-notification', handleNewNotification);
  }, []);

  useEffect(() => {
    apiClient.get('/api/auth/me').then(data => {
      if (data && data.name) {
        setUser(data);
        
        // Setup initial org
        const savedOrg = sessionStorage.getItem('active_org_id');
        const orgs = data.organizations || [];
        if (orgs.length > 0) {
          if (savedOrg && orgs.find((o: any) => o.org_id === savedOrg)) {
            setActiveOrgId(savedOrg);
          } else {
            setActiveOrgId(orgs[0].org_id);
            sessionStorage.setItem('active_org_id', orgs[0].org_id);
          }
        }
      }
    }).catch(err => {
      console.error("Failed to load profile", err);
    });
  }, []);

  const handleSignOut = () => {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('active_org_id');
    router.push('/login');
  };

  const handleOrgChange = (orgId: string) => {
    setActiveOrgId(orgId);
    sessionStorage.setItem('active_org_id', orgId);
    // Reload page to reset state across all scoped components
    window.location.reload();
  };

  const initials = user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').substring(0,2).toUpperCase() : 'JD';
  const displayName = user?.name || 'J. Doe';
  const activeOrg = user?.organizations?.find((o: any) => o.org_id === activeOrgId);



  return (
    <header className="h-16 border-b border-outline-variant/30 bg-background/80 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-6 pl-[296px]">
      
      {/* Organization Switcher & Nav */}
      <nav className="flex items-center gap-6">
        {user?.organizations && user.organizations.length > 0 && (
          <div className="relative group flex items-center border border-outline-variant/50 bg-surface-container-low px-3 py-1.5 rounded text-sm cursor-pointer hover:border-primary-container/50 transition-colors">
            <span className="material-symbols-outlined text-[16px] text-primary-container mr-2">domain</span>
            <span className="font-bold mr-2 text-on-surface">{activeOrg?.org_name || 'Select Org'}</span>
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">arrow_drop_down</span>
            
            <div className="absolute top-full left-0 mt-1 bg-surface-container-low border border-outline-variant rounded shadow-xl min-w-[200px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              {user.organizations.map((org: any) => (
                <button 
                  key={org.org_id}
                  onClick={() => handleOrgChange(org.org_id)}
                  className={`w-full text-left px-4 py-2 hover:bg-surface-variant transition-colors flex items-center justify-between ${org.org_id === activeOrgId ? 'text-primary-container font-bold' : 'text-on-surface'}`}
                >
                  <span className="font-label-md truncate">{org.org_name}</span>
                  {org.org_id === activeOrgId && <span className="material-symbols-outlined text-[14px]">check</span>}
                </button>
              ))}
              <div className="border-t border-outline-variant/30 mt-1">
                <Link href={`/organizations/${activeOrgId}/settings`} className="w-full text-left px-4 py-2 hover:bg-surface-variant text-on-surface-variant transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px]">settings</span>
                  <span className="font-label-md">Org Settings</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative p-2 rounded transition-colors ${showNotifications ? 'bg-surface-variant text-on-surface' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40'}`}
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            {hasUnread && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-container rounded-full border border-background"></span>
            )}
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 mt-2 w-[360px] bg-surface-container-high border border-outline-variant rounded-lg shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-4 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-highest">
                  <h4 className="font-headline-sm text-sm font-bold text-on-surface">Notifications</h4>
                  {hasUnread && (
                    <button 
                      onClick={markAllRead}
                      className="text-[11px] font-label-md uppercase tracking-wider text-primary-container hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="divide-y divide-outline-variant/20 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-on-surface-variant/70 text-sm italic">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        className={`p-4 transition-colors hover:bg-surface-variant/20 ${n.read ? 'opacity-70' : 'bg-primary-container/5 border-l-2 border-primary-container'}`}
                      >
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <span className={`font-headline-sm text-xs font-bold ${n.read ? 'text-on-surface' : 'text-primary-container'}`}>
                            {n.title}
                          </span>
                          <span className="text-[10px] text-on-surface-variant whitespace-nowrap">{n.time}</span>
                        </div>
                        <p className="text-[12px] text-on-surface-variant leading-relaxed">
                          {n.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        
        <div className="h-6 w-px bg-outline-variant/50"></div>
        
        <button className="flex items-center gap-2 p-1 pl-2 pr-3 rounded-full hover:bg-surface-variant/40 transition-colors border border-outline-variant/30 group relative">
          <div className="w-6 h-6 rounded-full bg-surface-variant flex items-center justify-center text-[10px] font-bold text-on-surface">
            {initials}
          </div>
          <span className="font-label-md text-[12px] text-on-surface">{displayName}</span>
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">expand_more</span>
          
          <div className="absolute top-full mt-2 right-0 bg-surface-container-low border border-outline-variant rounded shadow-xl py-2 min-w-[150px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
            <div className="px-4 py-2 border-b border-outline-variant/30 mb-1">
              <div className="font-label-md text-on-surface">{displayName}</div>
              <div className="font-label-md text-[10px] text-on-surface-variant uppercase mt-1">{activeOrg?.org_role || user?.role || 'Viewer'}</div>
            </div>
            <button onClick={handleSignOut} className="w-full text-left px-4 py-2 hover:bg-surface-variant text-on-surface-variant hover:text-error transition-colors flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">logout</span>
              <span className="font-label-md text-[12px] uppercase">Sign Out</span>
            </button>
          </div>
        </button>
      </div>
      
    </header>
  );
}
