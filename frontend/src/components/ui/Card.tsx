import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
  interactive?: boolean;
}

export function Card({
  className = '',
  noPadding = false,
  interactive = false,
  children,
  ...props
}: CardProps) {
  const baseStyles = 'bg-surface-container-low rounded-lg border border-outline-variant';
  const paddingStyles = noPadding ? '' : 'p-panel-padding';
  const interactiveStyles = interactive ? 'hover:border-primary-container/50 transition-colors cursor-pointer shadow-xl' : 'shadow-xl';

  return (
    <div
      className={`${baseStyles} ${paddingStyles} ${interactiveStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
