import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hover?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', hover = false, onClick, onKeyDown, tabIndex, role, ...props }) => {
  const isInteractive = Boolean(onClick);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);

    if (!event.defaultPrevented && onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick(event as unknown as React.MouseEvent<HTMLDivElement>);
    }
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={tabIndex ?? (isInteractive ? 0 : undefined)}
      role={role ?? (isInteractive ? 'button' : undefined)}
      className={`bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 ${
        hover ? 'hover:shadow-xl transition-all duration-300 hover:-translate-y-1' : ''
      } ${isInteractive ? 'cursor-pointer' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
