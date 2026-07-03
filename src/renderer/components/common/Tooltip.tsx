import React from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: boolean;
}

const positionClasses: Record<string, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

const arrowClasses: Record<string, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-800',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-800',
  left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-800',
  right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-800',
};

const Tooltip: React.FC<TooltipProps> = ({ text, children, position = 'top', delay = true }) => {
  return (
    <div className="relative group/tooltip inline-flex">
      {children}
      <div
        className={`
          pointer-events-none absolute z-50 whitespace-nowrap
          ${positionClasses[position]}
          px-2 py-1 rounded-md text-xs font-medium text-white bg-gray-800 shadow-lg
          opacity-0 group-hover/tooltip:opacity-100
          scale-95 group-hover/tooltip:scale-100
          ${delay ? 'transition-all duration-150 delay-300 group-hover/tooltip:delay-300' : 'transition-all duration-100'}
        `}
      >
        {text}
        <div className={`absolute border-4 ${arrowClasses[position]}`} />
      </div>
    </div>
  );
};

export default Tooltip;
