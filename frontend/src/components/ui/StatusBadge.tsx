import React from 'react';

interface StatusBadgeProps {
  status: 'draft' | 'in-progress' | 'completed' | 'conflict';
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const baseStyles = 'inline-flex items-center justify-center font-label-md text-[10px] uppercase tracking-wider px-2 py-0.5 whitespace-nowrap rounded-sm';
  
  const variants = {
    'draft': 'border border-outline-variant text-on-surface-variant bg-transparent',
    'in-progress': 'bg-primary-container text-on-primary-fixed-variant',
    'completed': 'bg-white text-black',
    'conflict': 'bg-error-container text-on-error-container',
  };

  const defaultLabels = {
    'draft': 'Draft',
    'in-progress': 'In Progress',
    'completed': 'Completed',
    'conflict': 'Conflict',
  };

  return (
    <span className={`${baseStyles} ${variants[status]} ${className}`}>
      {label || defaultLabels[status]}
    </span>
  );
}
