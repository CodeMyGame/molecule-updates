import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  X,
  Sparkles,
  Sun,
  Layers,
  Search,
  Receipt,
  ChefHat,
  Bell,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { useTourStore } from '../../stores/tour.store';

interface SpotlightStep {
  id: string;
  targetSelector: string;
  badge: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  placement: 'right' | 'left' | 'top' | 'bottom';
  accentBg: string;
}

export const QuickTourModal: React.FC = () => {
  const { isOpen, step, closeTour, nextStep, prevStep, setStep } = useTourStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [rect, setRect] = useState<DOMRect | null>(null);

  const steps: SpotlightStep[] = useMemo(
    () => [
      {
        id: 'sidebar',
        targetSelector: '[data-tour="sidebar-nav"]',
        badge: 'Main Navigation',
        title: 'Core Modules & Views',
        description:
          'Switch instantly between Billing POS, Tables & Floors, Menu Catalog, Kitchen Display (KDS), Inventory Recipes, Reports, and System Settings.',
        icon: <Layers size={18} className="text-blue-600" />,
        placement: 'right',
        accentBg: 'bg-blue-50 border-blue-200',
      },
      {
        id: 'day-session',
        targetSelector: '[data-tour="day-session-toggle"]',
        badge: 'Cash Reconciliation',
        title: 'Day Open & Day Close',
        description:
          'Click "Open Day" at the start of your shift to record starting cash float. At end of shift, click "Close Day" to reconcile physical cash and print handover summaries.',
        icon: <Sun size={18} className="text-amber-500" />,
        placement: 'right',
        accentBg: 'bg-amber-50 border-amber-200',
      },
      {
        id: 'menu-search',
        targetSelector: '[data-tour="menu-search"]',
        badge: 'Lightning-Fast Search',
        title: 'Search Dishes & Categories',
        description:
          'Quickly find items by typing dish names or short codes (e.g. "CRBR" for Crispy Burger). Filter by categories or Veg/Non-Veg icons, then tap to add to the bill.',
        icon: <Search size={18} className="text-emerald-600" />,
        placement: 'bottom',
        accentBg: 'bg-emerald-50 border-emerald-200',
      },
      {
        id: 'cart-panel',
        targetSelector: '[data-tour="cart-panel"]',
        badge: 'Order Customization',
        title: 'Active Order & Notes',
        description:
          'Review ordered dishes, adjust quantities, select portion variations (Half/Full), attach addon groups (Cheese, Mayo), and add special preparation notes for the chef.',
        icon: <Receipt size={18} className="text-blue-600" />,
        placement: 'left',
        accentBg: 'bg-blue-50 border-blue-200',
      },
      {
        id: 'cart-actions',
        targetSelector: '[data-tour="cart-actions"]',
        badge: 'Kitchen & Settlement',
        title: 'Send KOT & Settle Bill',
        description:
          'Hit "KOT" to print kitchen order tickets or send to the Kitchen Display screen. Once the meal is finished, click "Pay" to settle via Cash, UPI QR, Card, or Split Bill.',
        icon: <ChefHat size={18} className="text-orange-600" />,
        placement: 'left',
        accentBg: 'bg-orange-50 border-orange-200',
      },
      {
        id: 'heads-up',
        targetSelector: '[data-tour="heads-up-bell"]',
        badge: 'Live Analytics',
        title: 'Daily Heads-Up Pulse',
        description:
          'Click the bell icon anytime to inspect today\'s live revenue, order counts, yesterday\'s business recap, top-selling dishes, and low-stock alerts.',
        icon: <Bell size={18} className="text-amber-500" />,
        placement: 'bottom',
        accentBg: 'bg-amber-50 border-amber-200',
      },
      {
        id: 'quick-tour',
        targetSelector: '[data-tour="quick-tour-btn"]',
        badge: 'Always Here to Help',
        title: 'Restart Tour Anytime',
        description:
          'You can re-trigger this interactive walkthrough whenever new staff joins or as a quick refresher by clicking this Quick Tour button or visiting Settings.',
        icon: <Sparkles size={18} className="text-purple-600" />,
        placement: 'bottom',
        accentBg: 'bg-purple-50 border-purple-200',
      },
    ],
    []
  );

  const currentStep = steps[step] ?? steps[0];
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;

  // Make sure we are on /billing for the tour
  useEffect(() => {
    if (isOpen && location.pathname !== '/billing') {
      navigate('/billing');
    }
  }, [isOpen, location.pathname, navigate]);

  // Measure target element position
  const updateTargetRect = useCallback(() => {
    if (!isOpen) return;
    const el = document.querySelector(currentStep.targetSelector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      const r = el.getBoundingClientRect();
      setRect(r);
    } else {
      setRect(null);
    }
  }, [isOpen, currentStep.targetSelector]);

  useEffect(() => {
    if (!isOpen) return;

    updateTargetRect();
    const t1 = setTimeout(updateTargetRect, 80);
    const t2 = setTimeout(updateTargetRect, 250);

    const handleResize = () => updateTargetRect();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isOpen, step, updateTargetRect]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeTour();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (isLast) closeTour();
        else nextStep();
      } else if (e.key === 'ArrowLeft') {
        if (!isFirst) prevStep();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFirst, isLast, nextStep, prevStep, closeTour]);

  if (!isOpen) return null;

  const pad = 6;
  const tooltipWidth = 340;
  const tooltipHeight = 220;

  // Tooltip positioning
  let tooltipTop = 0;
  let tooltipLeft = 0;

  if (rect) {
    if (currentStep.placement === 'right') {
      tooltipLeft = rect.right + pad + 14;
      tooltipTop = rect.top + rect.height / 2 - tooltipHeight / 2;
    } else if (currentStep.placement === 'left') {
      tooltipLeft = rect.left - pad - tooltipWidth - 14;
      tooltipTop = rect.top + rect.height / 2 - tooltipHeight / 2;
    } else if (currentStep.placement === 'bottom') {
      tooltipTop = rect.bottom + pad + 14;
      tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
    } else if (currentStep.placement === 'top') {
      tooltipTop = rect.top - pad - tooltipHeight - 14;
      tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
    }

    // Window boundaries clamping
    tooltipLeft = Math.max(12, Math.min(window.innerWidth - tooltipWidth - 12, tooltipLeft));
    tooltipTop = Math.max(12, Math.min(window.innerHeight - tooltipHeight - 12, tooltipTop));
  } else {
    // Center fallback
    tooltipLeft = Math.max(12, (window.innerWidth - tooltipWidth) / 2);
    tooltipTop = Math.max(12, (window.innerHeight - tooltipHeight) / 2);
  }

  return createPortal(
    <div className="fixed inset-0 z-[99990] overflow-hidden select-none">
      {/* SVG Backdrop Cutout Mask */}
      {rect ? (
        <svg className="fixed inset-0 w-full h-full pointer-events-auto cursor-default">
          <defs>
            <mask id="spotlight-tour-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={Math.max(0, rect.left - pad)}
                y={Math.max(0, rect.top - pad)}
                width={rect.width + pad * 2}
                height={rect.height + pad * 2}
                rx="10"
                ry="10"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(15, 23, 42, 0.65)"
            mask="url(#spotlight-tour-mask)"
            onClick={closeTour}
          />
        </svg>
      ) : (
        <div
          className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs pointer-events-auto"
          onClick={closeTour}
        />
      )}

      {/* Target Pulsing Highlight Box */}
      {rect && (
        <div
          className="fixed pointer-events-none z-[99995] rounded-xl border-2 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.6)] animate-pulse transition-all duration-300 ease-out"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
          }}
        />
      )}

      {/* Floating Tooltip Card */}
      <div
        className="fixed z-[100000] w-[340px] max-w-[92vw] bg-white rounded-2xl shadow-2xl border border-gray-200/90 overflow-hidden flex flex-col transition-all duration-300 ease-out animate-in fade-in zoom-in-95"
        style={{
          top: tooltipTop,
          left: tooltipLeft,
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Tooltip Header */}
        <div className="px-4 pt-3.5 pb-2.5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-blue-100/90 text-blue-800">
              {currentStep.badge}
            </span>
            <span className="text-[11px] font-medium text-gray-400">
              {step + 1} of {steps.length}
            </span>
          </div>

          <button
            onClick={closeTour}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
            title="Close Tour (Esc)"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tooltip Body */}
        <div className="px-4 py-3.5 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border flex-shrink-0 ${currentStep.accentBg}`}>
              {currentStep.icon}
            </div>
            <h3 className="text-sm font-bold text-gray-900 tracking-tight leading-snug">
              {currentStep.title}
            </h3>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            {currentStep.description}
          </p>
        </div>

        {/* Tooltip Footer with Steps & Navigation Buttons */}
        <div className="px-4 py-3 bg-gray-50/90 border-t border-gray-150 flex items-center justify-between gap-2">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setStep(idx)}
                className={`transition-all rounded-full ${
                  idx === step
                    ? 'w-5 h-2 bg-blue-600'
                    : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
                }`}
                title={`Jump to ${s.title}`}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={closeTour}
              className="px-2 py-1 text-[11px] font-semibold text-gray-400 hover:text-gray-700 transition"
            >
              Skip
            </button>

            {!isFirst && (
              <button
                type="button"
                onClick={prevStep}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-200 border border-gray-300 bg-white transition flex items-center gap-1 shadow-xs active:scale-95"
              >
                <ArrowLeft size={13} />
                <span>Prev</span>
              </button>
            )}

            {isLast ? (
              <button
                type="button"
                onClick={closeTour}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <CheckCircle2 size={13} />
                <span>Finish</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={nextStep}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition flex items-center gap-1 shadow-sm active:scale-95"
              >
                <span>Next</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default QuickTourModal;
