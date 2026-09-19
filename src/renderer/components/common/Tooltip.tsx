import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: boolean;
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({
  text,
  children,
  position = 'top',
  delay = true,
  className = 'inline-flex',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    let top = 0;
    let left = 0;

    switch (position) {
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + 8;
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - 8;
        break;
      case 'bottom':
        top = rect.bottom + 8;
        left = rect.left + rect.width / 2;
        break;
      case 'top':
      default:
        top = rect.top - 8;
        left = rect.left + rect.width / 2;
        break;
    }

    setCoords({ top, left });
  }, [position]);

  const handleMouseEnter = () => {
    if (!text || !text.trim()) return;
    updatePosition();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      updatePosition();
      setIsVisible(true);
    }, delay ? 120 : 0);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const handleScrollOrResize = () => {
      setIsVisible(false);
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isVisible]);

  const getTransform = () => {
    switch (position) {
      case 'right':
        return 'translateY(-50%)';
      case 'left':
        return 'translate(-100%, -50%)';
      case 'bottom':
        return 'translateX(-50%)';
      case 'top':
      default:
        return 'translate(-50%, -100%)';
    }
  };

  const getArrowStyle = () => {
    switch (position) {
      case 'right':
        return 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-900';
      case 'left':
        return 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-900';
      case 'bottom':
        return 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-900';
      case 'top':
      default:
        return 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-900';
    }
  };

  return (
    <div
      ref={triggerRef}
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible &&
        text &&
        createPortal(
          <div
            className="fixed z-[99999] pointer-events-none whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-medium text-white bg-gray-900 border border-gray-700/80 shadow-xl"
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform: getTransform(),
            }}
          >
            {text}
            <div className={`absolute border-4 ${getArrowStyle()}`} />
          </div>,
          document.body
        )}
    </div>
  );
};

export default Tooltip;
