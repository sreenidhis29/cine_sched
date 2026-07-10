import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function Button({
  className = '',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-headline-md rounded transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary-container disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-primary-container text-on-primary-fixed-variant hover:brightness-110 active:scale-[0.99] font-bold shadow-lg shadow-primary-container/10',
    secondary: 'border border-outline-variant text-on-surface hover:bg-surface-variant/50 active:bg-surface-variant',
    ghost: 'text-on-surface-variant hover:text-primary-container hover:bg-surface-variant/30',
  };

  const sizes = {
    sm: 'text-sm py-1.5 px-3',
    md: 'text-headline-md py-3.5 px-6',
    lg: 'text-lg py-4 px-8',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
