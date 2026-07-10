import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, icon, ...props }, ref) => {
    return (
      <div className="space-y-unit">
        {label && (
          <label className="font-headline-md text-[13px] uppercase tracking-wider text-on-surface-variant block">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[18px]">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={`w-full bg-surface-container-lowest border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/20 input-focus-ring transition-all duration-200 ${
              icon ? 'pl-10' : ''
            } ${className}`}
            {...props}
          />
        </div>
      </div>
    );
  }
);

Input.displayName = 'Input';
