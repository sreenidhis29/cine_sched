import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  sidePanel?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, footer, sidePanel }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-[20px] transition-opacity" 
        onClick={onClose}
      />
      
      <div className="relative flex flex-col md:flex-row items-center md:items-stretch justify-center gap-4 max-w-4xl w-full max-h-[90vh] z-10">
        {/* Modal Panel (Level 2 Elevation) */}
        <div className="relative w-full max-w-lg bg-[#262626]/85 rounded-lg border border-outline-variant shadow-2xl flex flex-col max-h-[90vh]">
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-outline-variant/30">
            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">
              {title || 'Modal Title'}
            </h2>
            <button 
              onClick={onClose}
              className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Body */}
          <div className="p-panel-padding overflow-y-auto font-body-md text-body-md text-on-surface">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="p-4 border-t border-outline-variant/30 flex justify-end gap-3 bg-surface-container-low/50 rounded-b-lg">
              {footer}
            </div>
          )}
        </div>

        {sidePanel && (
          <div className="w-full md:w-[320px] flex-shrink-0 flex flex-col max-h-[90vh] md:max-h-none">
            {sidePanel}
          </div>
        )}
      </div>
    </div>
  );
}
