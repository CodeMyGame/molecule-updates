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
  BarChart3,
  Lock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWhatsNewStore } from '../../stores/whatsNew.store';
import { useTourStore } from '../../stores/tour.store';
import { RELEASES, ReleaseHighlight } from '../../data/changelog';

export const WhatsNewModal: React.FC = () => {
  const { t } = useTranslation();
  const { isOpen, closeWhatsNew, activeVersion } = useWhatsNewStore();
  const openTour = useTourStore((s) => s.openTour);
  const [selectedVersion, setSelectedVersion] = React.useState<string>(activeVersion || RELEASES[0]?.version);

  // Sync selectedVersion when activeVersion changes
  useEffect(() => {
    if (activeVersion) {
      setSelectedVersion(activeVersion);
    }
  }, [activeVersion]);

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

  const currentRelease = RELEASES.find((r) => r.version === selectedVersion) || RELEASES[0];

  const renderIcon = (iconName: ReleaseHighlight['icon']) => {
    switch (iconName) {
      case 'QrCode':
        return <QrCode size={18} className="text-blue-600 dark:text-blue-400" />;
      case 'Atom':
        return <Atom size={18} className="text-indigo-600 dark:text-indigo-400" />;
      case 'Palette':
        return <Palette size={18} className="text-purple-600 dark:text-purple-400" />;
      case 'Printer':
        return <Printer size={18} className="text-emerald-600 dark:text-emerald-400" />;
      case 'Languages':
        return <Languages size={18} className="text-cyan-600 dark:text-cyan-400" />;
      case 'ShieldCheck':
        return <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400" />;
      case 'Move':
        return <Move size={18} className="text-amber-600 dark:text-amber-400" />;
      case 'PackageCheck':
        return <PackageCheck size={18} className="text-blue-600 dark:text-blue-400" />;
      case 'Coins':
        return <Coins size={18} className="text-amber-500 dark:text-amber-400" />;
      case 'Zap':
        return <Zap size={18} className="text-yellow-500 dark:text-yellow-400" />;
      case 'BarChart3':
        return <BarChart3 size={18} className="text-blue-600 dark:text-blue-400" />;
      case 'Lock':
        return <Lock size={18} className="text-rose-600 dark:text-rose-400" />;
      case 'Sparkles':
      default:
        return <Sparkles size={18} className="text-blue-600 dark:text-blue-400" />;
    }
  };

  const tagBadge = (tag: ReleaseHighlight['tag']) => {
    switch (tag) {
      case 'New':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
            {tag}
          </span>
        );
      case 'Improved':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
            {tag}
          </span>
        );
      case 'Fix':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
            {tag}
          </span>
        );
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div
        className="relative flex flex-col w-full max-w-2xl max-h-[88vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700 animate-scale-up"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Hero Banner */}
        <div className="relative px-6 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white overflow-hidden shrink-0">
          {/* Subtle decorative circles */}
          <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="absolute -bottom-16 left-1/3 w-36 h-36 rounded-full bg-blue-400/20 blur-lg pointer-events-none" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 shadow-inner shrink-0">
                <Rocket size={20} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold tracking-tight text-white">
                    {t('whatsNew.title', "What's New in Molecule POS")}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white border border-white/30">
                    v{currentRelease.version}
                  </span>
                </div>
                <p className="text-xs text-blue-100 mt-0.5 font-medium line-clamp-1">
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

        {/* Release Version Tabs (Latest + Previous 2 Releases) */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mr-1 shrink-0">
            Versions:
          </span>
          {RELEASES.slice(0, 3).map((rel) => {
            const isSelected = currentRelease.version === rel.version;
            return (
              <button
                key={rel.version}
                type="button"
                onClick={() => setSelectedVersion(rel.version)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/20'
                    : 'bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 border border-transparent dark:border-gray-600'
                }`}
              >
                <span>v{rel.version}</span>
                {rel.badge && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      isSelected
                        ? 'bg-white/25 text-white'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                    }`}
                  >
                    {rel.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-gray-50/50 dark:bg-gray-900/60">
          {/* Release Summary Card */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-xs">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
              <span className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-500" />
                {currentRelease.title}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                <Calendar size={12} />
                {currentRelease.date}
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {currentRelease.summary}
            </p>
          </div>

          {/* Highlights List */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-1">
              Key Highlights & Updates
            </h3>
            {currentRelease.highlights.map((h, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3.5 p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200/70 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-xs transition-all"
              >
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/60 border border-gray-100 dark:border-gray-600 shrink-0 mt-0.5">
                  {renderIcon(h.icon)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white leading-tight">
                      {h.title}
                    </h4>
                    {tagBadge(h.tag)}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-normal">
                    {h.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button
            onClick={() => {
              closeWhatsNew();
              openTour(0);
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
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
