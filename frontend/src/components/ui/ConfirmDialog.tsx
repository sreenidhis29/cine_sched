'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle, Info, HelpCircle } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
}

type ConfirmFunction = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFunction | null>(null);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opt: ConfirmOptions) => {
    setOptions(opt);
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleCancel = () => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(false);
    }
  };

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(true);
    }
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {isOpen && options && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200" 
            onClick={handleCancel}
          />
          
          {/* Modal Container */}
          <div 
            className="relative bg-surface-container-low border border-outline-variant/30 max-w-md w-full rounded-2xl shadow-2xl p-6 z-10 animate-in fade-in zoom-in-95 duration-200 text-on-surface"
            style={{
              background: 'rgba(25, 26, 26, 0.95)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 184, 0, 0.05)'
            }}
          >
            <div className="flex gap-4 items-start">
              {/* Icon */}
              <div className={`p-3 rounded-xl flex-shrink-0 ${
                options.type === 'danger' 
                  ? 'bg-error/15 text-error border border-error/20' 
                  : options.type === 'info' 
                    ? 'bg-primary-container/20 text-primary-container border border-primary-container/20' 
                    : 'bg-[#ffb800]/15 text-[#ffb800] border border-[#ffb800]/20'
              }`}>
                {options.type === 'danger' ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : options.type === 'info' ? (
                  <Info className="w-6 h-6" />
                ) : (
                  <HelpCircle className="w-6 h-6" />
                )}
              </div>

              {/* Text Content */}
              <div className="space-y-2 flex-1">
                <h3 className="font-headline-md text-lg font-bold text-on-surface tracking-tight">
                  {options.title || 'Are you sure?'}
                </h3>
                <p className="font-body-md text-sm text-on-surface-variant/90 leading-relaxed">
                  {options.message}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-xs font-label-md uppercase tracking-wider font-bold rounded-lg border border-outline-variant text-on-surface hover:bg-surface-variant/30 active:scale-95 transition-all"
              >
                {options.cancelText || 'Cancel'}
              </button>
              <button
                onClick={handleConfirm}
                className={`px-5 py-2 text-xs font-label-md uppercase tracking-wider font-bold rounded-lg active:scale-95 transition-all shadow-lg ${
                  options.type === 'danger'
                    ? 'bg-error text-on-error hover:brightness-110 shadow-error/10'
                    : 'bg-primary-container text-on-primary-fixed hover:brightness-110 shadow-[#ffb800]/10'
                }`}
              >
                {options.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};
