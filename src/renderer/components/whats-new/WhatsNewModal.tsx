import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sparkles,
  Rocket,
  QrCode,
  Atom,
  Palette,
  Printer,
  Languages,
  ShieldCheck,
  Move,
  PackageCheck,
  Coins,
  Zap,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWhatsNewStore } from '../../stores/whatsNew.store';
import { useTourStore } from '../../stores/tour.store';
import { RELEASES, ReleaseHighlight } from '../../data/changelog';

export const WhatsNewModal: React.FC = () => {
  const { t } = useTranslation();
  const { isOpen, closeWhatsNew } = useWhatsNewStore();
  const openTour = useTourStore((s) => s.openTour);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeWhatsNew();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeWhatsNew]);

  if (!isOpen) return null;

  const currentRelease = RELEASES[0];

  const renderIcon = (iconName: ReleaseHighlight['icon']) => {
    switch (iconName) {
      case 'QrCode':
        return <QrCode size={18} className="text-blue-600" />;
      case 'Atom':
        return <Atom size={18} className="text-indigo-600" />;
      case 'Palette':
        return <Palette size={18} className="text-purple-600" />;
      case 'Printer':
        return <Printer size={18} className="text-emerald-600" />;
      case 'Languages':
        return <Languages size={18} className="text-cyan-600" />;
      case 'ShieldCheck':
        return <ShieldCheck size={18} className="text-emerald-600" />;
      case 'Move':
        return <Move size={18} className="text-amber-600" />;
      case 'PackageCheck':
        return <PackageCheck size={18} className="text-blue-600" />;
      case 'Coins':
        return <Coins size={18} className="text-amber-500" />;
      case 'Zap':
        return <Zap size={18} className="text-yellow-500" />;
      case 'Sparkles':
      default:
        return <Sparkles size={18} className="text-blue-600" />;
    }
  };

  const tagBadge = (tag: ReleaseHighlight['tag']) => {
    switch (tag) {
      case 'New':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
            {tag}
          </span>
        );
      case 'Improved':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-blue-100 text-blue-800 border border-blue-200">
            {tag}
          </span>
        );
      case 'Fix':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-100 text-amber-800 border border-amber-200">
            {tag}
          </span>
        );
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div
        className="relative flex flex-col w-full max-w-2xl max-h-[88vh] bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 animate-scale-up"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Hero Banner */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white overflow-hidden shrink-0">
          {/* Subtle decorative circles */}
          <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="absolute -bottom-16 left-1/3 w-36 h-36 rounded-full bg-blue-400/20 blur-lg pointer-events-none" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 shadow-inner">
                <Rocket size={22} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold tracking-tight text-white">
                    {t('whatsNew.title', "What's New in Molecule POS")}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white border border-white/30">
                    v{currentRelease.version}
                  </span>
                </div>
                <p className="text-xs text-blue-100 mt-0.5 font-medium">
                  {currentRelease.title}
                </p>
              </div>
            </div>

            <button
              onClick={closeWhatsNew}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors focus:outline-none"
              title={t('common.close', 'Close')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-gray-50/50">
          {/* Release Summary Card */}
          <div className="p-4 bg-white rounded-xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span className="font-semibold text-gray-700 flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-500" />
                {currentRelease.title}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                <Calendar size={12} />
                {currentRelease.date}
              </span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {currentRelease.summary}
            </p>
          </div>

          {/* Highlights List */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 px-1">
              Key Highlights & Updates
            </h3>
            {currentRelease.highlights.map((h, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3.5 p-3.5 bg-white rounded-xl border border-gray-200/70 hover:border-blue-300 hover:shadow-xs transition-all"
              >
                <div className="p-2 rounded-lg bg-gray-50 border border-gray-100 shrink-0 mt-0.5">
                  {renderIcon(h.icon)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="text-xs font-bold text-gray-900 leading-tight">
                      {h.title}
                    </h4>
                    {tagBadge(h.tag)}
                  </div>
                  <p className="text-xs text-gray-600 leading-normal">
                    {h.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-white border-t border-gray-200 shrink-0">
          <button
            onClick={() => {
              closeWhatsNew();
              openTour(0);
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-blue-600 transition-colors"
          >
            <Layers size={14} className="text-gray-400" />
            <span>{t('header.quickTour', 'Take Quick Tour')}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={closeWhatsNew}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow transition-all active:scale-95"
            >
              <CheckCircle2 size={14} />
              <span>{t('whatsNew.gotIt', "Got it, Let's Go!")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default WhatsNewModal;
