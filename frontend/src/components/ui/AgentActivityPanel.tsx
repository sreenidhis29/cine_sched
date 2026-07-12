import React, { useEffect, useState } from 'react';

interface AgentActivityPanelProps {
  isActive: boolean;
  steps: string[];
}

export function AgentActivityPanel({ isActive, steps }: AgentActivityPanelProps) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setVisibleCount(0);
      return;
    }

    // Initialize with first step
    setVisibleCount(1);

    const interval = setInterval(() => {
      setVisibleCount((prev) => {
        if (prev < steps.length) {
          return prev + 1;
        }
        clearInterval(interval);
        return prev;
      });
    }, 600); // 600ms delay between steps

    return () => clearInterval(interval);
  }, [isActive, steps]);

  if (!isActive) return null;

  return (
    <div className="flex flex-col h-full bg-[#121212]/95 text-on-surface border border-outline-variant/50 rounded-lg p-5 font-mono text-xs shadow-2xl">
      {/* Panel Title/Header */}
      <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-3 mb-4 flex-shrink-0">
        <span className="w-2 h-2 rounded-full bg-[#ff5f56]" />
        <span className="w-2 h-2 rounded-full bg-[#ffbd2e]" />
        <span className="w-2 h-2 rounded-full bg-[#27c93f]" />
        <h3 className="ml-2 font-bold font-sans text-[11px] text-primary-container tracking-widest uppercase flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
          Agent Activity
        </h3>
      </div>

      {/* Terminal Feed */}
      <div className="flex-1 space-y-3 overflow-y-auto min-h-[160px] md:min-h-0 pr-1 select-none font-mono">
        {steps.slice(0, visibleCount).map((step, idx) => {
          const isLastVisible = idx === visibleCount - 1;
          const isDone = step.toLowerCase() === 'done.';
          return (
            <div key={idx} className="flex items-start gap-2 leading-relaxed font-mono">
              {!isDone ? (
                <>
                  {isLastVisible && visibleCount < steps.length ? (
                    <span className="text-primary-container flex-shrink-0 font-mono">➜</span>
                  ) : (
                    <span className="text-green-400 flex-shrink-0 font-mono">✓</span>
                  )}
                  <span className={isLastVisible && visibleCount < steps.length ? "text-on-surface font-mono" : "text-on-surface-variant font-mono"}>
                    {step}
                    {isLastVisible && visibleCount < steps.length && (
                      <span className="inline-block w-1.5 h-3.5 ml-1 bg-primary-container animate-pulse align-middle" />
                    )}
                  </span>
                </>
              ) : (
                <div className="w-full mt-2 pt-2 border-t border-outline-variant/20 flex items-center gap-2 text-green-400 font-bold font-mono">
                  <span>🚀</span>
                  <span>{step.toUpperCase()}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
