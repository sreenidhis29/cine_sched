'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { apiClient } from '@/lib/apiClient';
import { WeatherBadge, WeatherForecastStrip } from '@/components/ui/WeatherBadge';


export default function ScheduleViewPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [scenes, setScenes] = useState<any[]>([]);
  const [budget, setBudget] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // Phase 4: weather forecast data (keyed by shoot_day string)
  const [dayForecasts, setDayForecasts] = useState<Record<string, any>>({});
  
  // What-If State
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: string, content: string}[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const projectData = await apiClient.get(`/api/projects/${projectId}`);
        if (projectData) setProject(projectData);
      } catch (e) {
        console.error("Failed to load project details:", e);
      }

      try {
        const budgetData = await apiClient.get(`/api/projects/${projectId}/budget`);
        if (budgetData) setBudget(budgetData);
      } catch (e) {
        console.error("Failed to load budget details:", e);
      }

      try {
        const scenesData = await apiClient.get(`/api/projects/${projectId}/scenes`);
        if (scenesData) setScenes(scenesData);
      } catch (e) {
        console.error("Failed to load scenes:", e);
      }

      try {
        const scheduleData = await apiClient.get(`/api/projects/${projectId}/schedule`);
        if (scheduleData) {
          setSchedule(scheduleData);
          // Phase 4: extract day_forecasts from the extra_context if stored
          // (The backend attaches these via the weather_agent state.)
          // For now we parse them from the schedule's violations advisory strings
          // and also check for a dedicated forecast endpoint in future phases.
          const forecasts = scheduleData?.extra_context?.day_forecasts || {};
          setDayForecasts(forecasts);
        }
      } catch (e) {
        console.error("Failed to load schedule (might not exist yet):", e);
      }
      setLoading(false);
    };
    fetchData();
  }, [projectId]);

  const handleWhatIfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    
    const userMsg = chatMessage;
    setChatHistory(prev => [...prev, {role: 'user', content: userMsg}]);
    setChatMessage('');
    setChatLoading(true);

    try {
      const data = await apiClient.post(`/api/projects/${projectId}/whatif`, {
        message: userMsg
      });
      setChatHistory(prev => [...prev, {role: 'assistant', content: 'Schedule updated based on your scenario.'}]);
      // The whatif endpoint presumably runs a new schedule or returns an updated one.
      // We refetch the schedule to get the latest state.
      const newScheduleData = await apiClient.get(`/api/projects/${projectId}/schedule`);
      if (newScheduleData) setSchedule(newScheduleData);
    } catch (err: any) {
      setChatHistory(prev => [...prev, {role: 'assistant', content: `Error: ${err.message}`}]);
    } finally {
      setChatLoading(false);
    }
  };

  // Group entries by day
  const scheduleDays = React.useMemo(() => {
    if (!schedule || !schedule.entries || !scenes) return [];
    const daysMap = new Map();
    
    schedule.entries.forEach((entry: any) => {
      const day = entry.shoot_day;
      if (!daysMap.has(day)) {
        daysMap.set(day, {
          day,
          date: entry.shoot_date ? entry.shoot_date : `DAY ${day}`,
          label: `DAY ${day}`,
          forecast: dayForecasts[String(day)] || null,
          scenes: []
        });
      }
      
      const sceneData = scenes.find(s => s.id === entry.scene_id);
      
      daysMap.get(day).scenes.push({
        id: sceneData ? sceneData.scene_number : entry.scene_id,
        type: sceneData ? sceneData.setting : 'UNK',
        title: sceneData ? sceneData.title : 'Unknown Scene',
        time: `${entry.start_time?.substring(0,5) || '??:??'} - ${entry.end_time?.substring(0,5) || '??:??'}`,
        cast: 'Multiple',
        status: schedule.violations.some((v: string) => !v.startsWith('[') && v.includes(entry.scene_id)) ? 'conflict' : 'completed'
      });
    });
    
    return Array.from(daysMap.values()).sort((a, b) => a.day - b.day);
  }, [schedule, scenes, dayForecasts]);

  // Phase 4: Split violations into hard conflicts vs advisories
  const { hardViolations, advisoryViolations } = React.useMemo(() => {
    const violations: string[] = schedule?.violations || [];
    const hard = violations.filter((v: string) => !v.startsWith('[WEATHER') && !v.startsWith('[TRAVEL') && !v.startsWith('[CONTINUITY'));
    const advisory = violations.filter((v: string) => v.startsWith('[WEATHER') || v.startsWith('[TRAVEL') || v.startsWith('[CONTINUITY'));
    return { hardViolations: hard, advisoryViolations: advisory };
  }, [schedule]);

  const satisfactionScore = schedule?.is_feasible ? 100 : Math.max(0, 100 - (schedule?.violations?.length || 0) * 10);

  return (
    <AppShell>
      <div className="py-stack-md animate-in fade-in duration-500 flex h-[calc(100vh-64px)] overflow-hidden gap-gutter">
        
        {/* Main Schedule Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 pb-4 mb-stack-md border-b border-outline-variant/30 flex-shrink-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-on-surface-variant font-label-md uppercase tracking-wider mb-2 text-xs">
                <Link href="/projects" className="hover:text-primary-container transition-colors">Projects</Link>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                <Link href={`/projects/${projectId}`} className="hover:text-primary-container transition-colors truncate max-w-[150px]">
                  {project?.name || 'Loading...'}
                </Link>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                <span className="text-on-surface font-semibold">Master Schedule</span>
              </div>
              <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">Master Schedule</h1>
            </div>
            <div className="flex flex-wrap gap-3 flex-shrink-0">
              <Link href={`/projects/${projectId}/trace`} className="flex items-center gap-2 border border-primary-container text-primary-container hover:bg-primary-container/10 px-3.5 py-2 rounded font-label-md uppercase tracking-wider font-bold transition-all text-xs">
                <span className="material-symbols-outlined text-[16px]">psychology</span>
                View Trace
              </Link>
              <button 
                onClick={async () => {
                  try {
                    const res = await apiClient.post(`/api/calendar/${projectId}/sync`, {});
                    alert(`Successfully synced! Created ${res.events_created} events.`);
                  } catch (e: any) {
                    if (e.message?.includes('401')) {
                      const res = await apiClient.get('/api/calendar/auth');
                      if (res && res.auth_url) window.location.href = res.auth_url;
                    } else {
                      alert('Failed to sync calendar: ' + e.message);
                    }
                  }
                }}
                className="flex items-center gap-2 border border-outline-variant text-on-surface hover:bg-surface-variant/50 px-3.5 py-2 rounded font-label-md uppercase tracking-wider font-bold transition-all text-xs"
              >
                <span className="material-symbols-outlined text-[16px]">calendar_add_on</span>
                Sync Calendar
              </button>
              <button 
                onClick={() => {
                  window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/projects/${projectId}/callsheet/1`, '_blank');
                }}
                className="flex items-center gap-2 border border-outline-variant text-on-surface hover:bg-surface-variant/50 px-3.5 py-2 rounded font-label-md uppercase tracking-wider font-bold transition-all text-xs"
              >
                <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                Call Sheet (Day 1)
              </button>
            </div>
          </div>

          {/* Weather Forecast Strip — Phase 4 */}
          {Object.keys(dayForecasts).length > 0 && (
            <WeatherForecastStrip dayForecasts={dayForecasts} />
          )}

          {/* Timeline Grid */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-stack-lg custom-scrollbar">
            {loading ? (
               <div className="flex justify-center items-center h-full text-on-surface-variant">Loading schedule...</div>
            ) : scheduleDays.length === 0 ? (
               <div className="flex justify-center items-center h-full text-on-surface-variant">No schedule found. Try running the scheduler.</div>
            ) : (
              scheduleDays.map((day, i) => (
                <div key={i}>
                  <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-2 mb-4 sticky top-0 bg-background/90 backdrop-blur-sm z-10">
                    <h3 className="font-label-md text-[14px] uppercase tracking-wider text-on-surface-variant">
                      {day.label}
                    </h3>
                    {day.date && day.date !== day.label && (
                      <span className="text-[11px] text-on-surface-variant/60">{day.date}</span>
                    )}
                    {/* Phase 4: Per-day weather badge */}
                    {day.forecast && (
                      <WeatherBadge
                        date={day.forecast.date}
                        precipMm={day.forecast.precipitation_sum_mm}
                        weatherCode={day.forecast.weather_code}
                        windSpeedKmh={day.forecast.wind_speed_max_kmh}
                        isHighRisk={day.forecast.is_high_risk}
                        compact
                      />
                    )}
                    <button 
                      onClick={() => {
                        window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/projects/${projectId}/callsheet/${day.day}`, '_blank');
                      }}
                      className="ml-auto flex items-center gap-1.5 border border-outline-variant text-on-surface hover:bg-surface-variant/50 px-2 py-1 rounded font-label-md uppercase tracking-wider font-bold transition-all text-[10px]"
                    >
                      <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
                      Call Sheet
                    </button>
                  </div>
                  <div className="space-y-unit">
                    {day.scenes.map((scene: any, j: number) => (
                      <div 
                        key={j} 
                        className="bg-surface-container-low border border-outline-variant rounded flex items-stretch hover:border-primary-container/50 transition-colors shadow-sm"
                      >
                        {/* Left Accent Bar */}
                        <div className={`w-1.5 rounded-l ${scene.type && scene.type.includes('EXT') ? 'bg-primary-container' : 'bg-accent'}`} />
                        
                        <div className="p-3 flex-1 flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <div className="font-mono-data text-mono-data text-on-surface bg-surface-container px-2 py-1 rounded">
                              {scene.time}
                            </div>
                            <div>
                              <span className="font-headline-md text-[14px] font-bold text-on-surface">{scene.id} - {scene.title}</span>
                              <div className="font-label-md text-[11px] text-on-surface-variant uppercase mt-1">
                                {scene.type}
                              </div>
                            </div>
                          </div>
                          
                          {scene.status === 'conflict' && (
                            <div className="flex items-center gap-1 text-error">
                              <span className="material-symbols-outlined text-[18px]">warning</span>
                              <span className="font-label-md text-[11px] uppercase tracking-wider">Conflict</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side Panel */}
        <div className="w-[320px] flex-shrink-0 flex flex-col gap-gutter overflow-y-auto custom-scrollbar pb-8">
          
          {/* Financial Status Panel */}
          {schedule && (
            <Card className="flex-shrink-0">
              <h3 className="font-label-md uppercase tracking-wider text-on-surface-variant mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                Financial Status
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[11px] font-label-md uppercase tracking-wider text-on-surface-variant mb-1">
                    <span>Burn Rate</span>
                    <span className="text-primary-container">
                      {budget && parseFloat(budget.total_limit) > 0 
                        ? `${Math.min(100, (schedule.total_cost / parseFloat(budget.total_limit)) * 100).toFixed(0)}%` 
                        : '0%'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-bright rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary-container rounded-full" 
                      style={{ 
                        width: `${budget && parseFloat(budget.total_limit) > 0 
                          ? Math.min(100, (schedule.total_cost / parseFloat(budget.total_limit)) * 100) 
                          : 0}%` 
                      }} 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-outline-variant/30">
                  <div>
                    <div className="font-label-md text-[10px] text-on-surface-variant uppercase mb-1">Estimated Cost</div>
                    <div className="font-mono-data text-on-surface text-[14px]">
                      {schedule.total_cost !== undefined && schedule.total_cost !== null 
                        ? `$${schedule.total_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}` 
                        : '$N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="font-label-md text-[10px] text-on-surface-variant uppercase mb-1">Budget Cap</div>
                    <div className="font-mono-data text-on-surface-variant text-[14px]">
                      {budget && parseFloat(budget.total_limit) > 0 
                        ? `$${parseFloat(budget.total_limit).toLocaleString('en-US', { maximumFractionDigits: 0 })}` 
                        : '$N/A'}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* AI Analysis Card */}
          {schedule && (
            <Card className="flex-shrink-0 bg-surface-container-high border-primary-container/30">
              <h3 className="font-label-md uppercase tracking-wider text-primary-container mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">psychology</span>
                CineFlow AI Analysis
              </h3>
              <div className="space-y-3 font-body-md text-[13px] text-on-surface leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar">
                <p>
                  The current schedule achieves <strong className="text-white">{satisfactionScore}% constraint satisfaction</strong>.
                </p>
                {/* Hard violations — blocks scheduling */}
                {hardViolations.map((v: string, i: number) => (
                  <div key={i} className="bg-error-container/20 border border-error-container p-3 rounded text-error-container text-xs">
                    <div className="font-bold flex items-center gap-1 mb-1">
                      <span className="material-symbols-outlined text-[16px]">warning</span> Conflict Detected
                    </div>
                    {v}
                  </div>
                ))}
                {/* Phase 4: Advisory violations — informational only */}
                {advisoryViolations.map((v: string, i: number) => {
                  const isWeather = v.startsWith('[WEATHER');
                  const isTravel = v.startsWith('[TRAVEL');
                  const icon = isWeather ? '🌧️' : isTravel ? '🚗' : '🎬';
                  return (
                    <div key={`adv-${i}`} style={{
                      backgroundColor: 'rgba(234, 88, 12, 0.08)',
                      border: '1px solid rgba(234, 88, 12, 0.25)',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      fontSize: '11px',
                      color: '#c2683a',
                    }}>
                      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span>{icon}</span> Advisory
                      </div>
                      {v.replace(/^\[[A-Z ]+\] /, '')}
                    </div>
                  );
                })}
                {schedule.relaxations?.map((r: string, i: number) => (
                  <div key={i} className="bg-surface-bright border border-outline-variant p-3 rounded text-on-surface-variant text-xs">
                    <div className="font-bold flex items-center gap-1 mb-1">
                      <span className="material-symbols-outlined text-[16px]">info</span> Relaxation Made
                    </div>
                    {r}
                  </div>
                ))}
                {schedule.explanation && (
                  <p className="text-on-surface-variant mt-2 border-t border-outline-variant/30 pt-2 text-xs italic">
                    {schedule.explanation}
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* What-If Chat */}
          <Card className="flex-shrink-0 flex flex-col h-[400px]">
             <h3 className="font-label-md uppercase tracking-wider text-on-surface-variant mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">chat</span>
                What-If Scenario
             </h3>
             <div className="flex-1 overflow-y-auto mb-3 space-y-3 text-[13px] custom-scrollbar">
               {chatHistory.length === 0 && (
                 <p className="text-on-surface-variant italic text-center mt-4">Ask CineFlow to adjust the schedule (e.g. &quot;What if John gets sick tomorrow?&quot;)</p>
               )}
               {chatHistory.map((msg, idx) => (
                 <div key={idx} className={`p-2 rounded max-w-[90%] ${msg.role === 'user' ? 'bg-primary-container/20 border border-primary-container/30 text-on-surface self-end ml-auto' : 'bg-surface-container border border-outline-variant text-on-surface-variant'}`}>
                   {msg.content}
                 </div>
               ))}
               {chatLoading && (
                 <div className="text-on-surface-variant italic text-xs animate-pulse">CineFlow is calculating new schedule...</div>
               )}
             </div>
             <form onSubmit={handleWhatIfSubmit} className="flex gap-2 border-t border-outline-variant/30 pt-3">
               <input 
                 type="text" 
                 value={chatMessage} 
                 onChange={e => setChatMessage(e.target.value)} 
                 placeholder="Type scenario..." 
                 className="flex-1 bg-surface-container border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:border-primary-container focus:outline-none transition-colors"
                 disabled={chatLoading}
               />
               <button 
                 type="submit" 
                 disabled={chatLoading || !chatMessage.trim()} 
                 className="bg-primary-container text-on-primary-fixed-variant px-3 py-2 rounded hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
               >
                 <span className="material-symbols-outlined text-[18px]">send</span>
               </button>
             </form>
          </Card>

        </div>
      </div>
    </AppShell>
  );
}
