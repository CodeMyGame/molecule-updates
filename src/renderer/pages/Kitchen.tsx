import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MonitorPlay,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useKOTStore } from '../stores/kot.store';
import { KOTStatus } from '../../shared/enums';
import KOTCard from '../components/kitchen/KOTCard';
import StationFilter from '../components/kitchen/StationFilter';

const KitchenClock: React.FC = React.memo(() => {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = time.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <div className="text-right pl-1">
      <div className="text-lg font-mono font-bold text-gray-900 dark:text-white tabular-nums tracking-tight leading-none">
        {timeString}
      </div>
    </div>
  );
});

type StatusFilterKey = 'all' | 'pending' | 'preparing' | 'ready' | 'overdue';

const KitchenDisplay: React.FC = () => {
  const { t } = useTranslation();
  const {
    activeKOTs,
    completedKOTs,
    selectedStation,
    loading,
    fetchKOTs,
    updateKOTStatus,
    setStation,
    getFilteredKOTs,
    getStationCounts,
  } = useKOTStore();

  const [showCompleted, setShowCompleted] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen event listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore if fullscreen request is denied
    }
  };

  // Persist sound preference across navigation/reload.
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('kitchen.soundEnabled') === 'true';
  });
  const setSoundEnabled = (value: boolean) => {
    setSoundEnabledState(value);
    try {
      window.localStorage.setItem('kitchen.soundEnabled', value ? 'true' : 'false');
    } catch { /* ignore quota / privacy mode */ }
  };

  // Start auto-refresh on mount — use getState() to avoid stale deps
  useEffect(() => {
    useKOTStore.getState().startAutoRefresh();
    return () => useKOTStore.getState().stopAutoRefresh();
  }, []);

  // Detect newly-arrived KOTs from polling diffs and play a sound.
  const seenKotIds = useRef<Set<number> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);

  // Browsers block audio until a user gesture. Listen for the first tap/click
  // on the kitchen page and unlock the AudioContext so subsequent beeps play.
  useEffect(() => {
    const unlock = () => {
      if (audioUnlockedRef.current) return;
      try {
        const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctor) return;
        const ctx: AudioContext = audioCtxRef.current ?? new Ctor();
        audioCtxRef.current = ctx;
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});

        // Play a near-silent buffer so iOS Safari treats the context as "unlocked".
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);

        audioUnlockedRef.current = true;
      } catch {
        // ignore
      }
    };
    const events: (keyof DocumentEventMap)[] = ['pointerdown', 'touchstart', 'keydown', 'click'];
    events.forEach((e) => document.addEventListener(e, unlock, { once: false, passive: true }));
    return () => {
      events.forEach((e) => document.removeEventListener(e, unlock));
    };
  }, []);

  useEffect(() => {
    const ids = new Set(activeKOTs.map((k) => k.id));

    // First fetch — just record the baseline, don't beep for existing KOTs.
    if (seenKotIds.current === null) {
      seenKotIds.current = ids;
      return;
    }

    let hasNew = false;
    for (const id of ids) {
      if (!seenKotIds.current.has(id)) { hasNew = true; break; }
    }
    seenKotIds.current = ids;

    if (hasNew && soundEnabled) {
      try {
        const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctor) return;
        const ctx: AudioContext = audioCtxRef.current ?? new Ctor();
        audioCtxRef.current = ctx;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        if (ctx.state !== 'running') return;

        const t0 = ctx.currentTime;
        const DURATION = 2.0;

        const lowOsc = ctx.createOscillator();
        const highOsc = ctx.createOscillator();
        lowOsc.type = 'square';
        highOsc.type = 'sine';
        lowOsc.frequency.value = 880;
        highOsc.frequency.value = 1320;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.9, t0 + 0.02);
        gain.gain.setValueAtTime(0.9, t0 + DURATION - 0.15);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + DURATION);

        lowOsc.connect(gain);
        highOsc.connect(gain);
        gain.connect(ctx.destination);

        lowOsc.start(t0);
        highOsc.start(t0);
        lowOsc.stop(t0 + DURATION);
        highOsc.stop(t0 + DURATION);
      } catch {
        // Audio not available (autoplay blocked, etc.)
      }
    }
  }, [activeKOTs, soundEnabled]);

  const filteredKOTs = getFilteredKOTs();
  const stationCounts = getStationCounts();

  // Helper to calculate elapsed minutes for overdue checks
  const getElapsedMins = (createdAt: string): number => {
    if (!createdAt) return 0;
    const ts = createdAt.endsWith('Z') ? createdAt : createdAt.replace(' ', 'T') + 'Z';
    const created = new Date(ts).getTime();
    return Math.floor((Date.now() - created) / 60000);
  };

  // Status Queue Breakdown for the active station view
  const statusCounts = useMemo(() => {
    let pending = 0;
    let preparing = 0;
    let ready = 0;
    let overdue = 0;

    for (const kot of activeKOTs) {
      if (selectedStation !== 'all' && kot.station !== selectedStation) {
        continue;
      }
      if (kot.status === KOTStatus.PENDING || kot.status === KOTStatus.SENT) {
        pending++;
      } else if (kot.status === KOTStatus.PREPARING) {
        preparing++;
      } else if (kot.status === KOTStatus.READY) {
        ready++;
      }

      if (getElapsedMins(kot.createdAt) >= 20) {
        overdue++;
      }
    }

    return {
      all: filteredKOTs.length,
      pending,
      preparing,
      ready,
      overdue,
    };
  }, [activeKOTs, filteredKOTs.length, selectedStation]);

  // Filtered displayed KOTs based on selected station AND status filter
  const displayedKOTs = useMemo(() => {
    if (statusFilter === 'all') return filteredKOTs;
    if (statusFilter === 'pending') {
      return filteredKOTs.filter((k) => k.status === KOTStatus.PENDING || k.status === KOTStatus.SENT);
    }
    if (statusFilter === 'preparing') {
      return filteredKOTs.filter((k) => k.status === KOTStatus.PREPARING);
    }
    if (statusFilter === 'ready') {
      return filteredKOTs.filter((k) => k.status === KOTStatus.READY);
    }
    if (statusFilter === 'overdue') {
      return filteredKOTs.filter((k) => getElapsedMins(k.createdAt) >= 20);
    }
    return filteredKOTs;
  }, [filteredKOTs, statusFilter]);

  const handleUpdateStatus = (id: number, status: KOTStatus) => {
    updateKOTStatus(id, status);
  };

  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-slate-950 text-gray-900 dark:text-white overflow-hidden select-none">
      {/* Enterprise Header */}
      <header className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center justify-between px-5 py-2.5 gap-4">
          {/* Left: Branding & Live Sync indicator */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-2xs">
              <MonitorPlay size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
                  {t('kitchen.title', 'Kitchen Display')}
                </h1>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{t('kitchen.liveSync', 'Live Sync')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center: Station Filter Capsule */}
          <div className="flex-1 flex justify-center">
            <StationFilter
              selectedStation={selectedStation}
              onSelect={setStation}
              counts={stationCounts}
            />
          </div>

          {/* Right Controls: Sound, Manual Refresh, Fullscreen, Clock */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg transition-colors border ${
                soundEnabled
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 shadow-2xs'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:text-gray-900 dark:hover:text-white'
              }`}
              title={soundEnabled ? t('kitchen.muteSound') : t('kitchen.unmuteSound')}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              onClick={fetchKOTs}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-slate-700 disabled:opacity-50"
              title={t('common.refresh')}
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-slate-700"
              title={isFullscreen ? t('kitchen.exitFullscreen', 'Exit Fullscreen') : t('kitchen.fullscreen', 'Fullscreen')}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <div className="h-6 w-px bg-gray-200 dark:bg-slate-700 mx-1" />
            <KitchenClock />
          </div>
        </div>

        {/* Status Queue Filter Ribbon */}
        <div className="px-5 py-2 bg-gray-50/90 dark:bg-slate-900/90 border-t border-gray-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {/* All */}
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`
                px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all
                ${
                  statusFilter === 'all'
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700'
                }
              `}
            >
              <span>{t('kitchen.stationAll', 'All')}</span>
              <span
                className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                  statusFilter === 'all'
                    ? 'bg-white/20 dark:bg-black/15 text-inherit'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                }`}
              >
                {statusCounts.all}
              </span>
            </button>

            {/* New / Pending */}
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
              className={`
                px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all
                ${
                  statusFilter === 'pending'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 border border-blue-200/70 dark:border-blue-900/40'
                }
              `}
            >
              <Sparkles size={13} />
              <span>{t('kitchen.kotStatusNew', 'New')}</span>
              <span
                className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                  statusFilter === 'pending'
                    ? 'bg-white/25 text-white'
                    : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                }`}
              >
                {statusCounts.pending}
              </span>
            </button>

            {/* Preparing */}
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'preparing' ? 'all' : 'preparing')}
              className={`
                px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all
                ${
                  statusFilter === 'preparing'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-700 border border-amber-200/70 dark:border-amber-900/40'
                }
              `}
            >
              <Flame size={13} />
              <span>{t('kitchen.kotStatusPreparing', 'Preparing')}</span>
              <span
                className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                  statusFilter === 'preparing'
                    ? 'bg-white/25 text-white'
                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                }`}
              >
                {statusCounts.preparing}
              </span>
            </button>

            {/* Ready */}
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'ready' ? 'all' : 'ready')}
              className={`
                px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all
                ${
                  statusFilter === 'ready'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-700 border border-emerald-200/70 dark:border-emerald-900/40'
                }
              `}
            >
              <CheckCircle2 size={13} />
              <span>{t('kitchen.kotStatusReady', 'Ready')}</span>
              <span
                className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                  statusFilter === 'ready'
                    ? 'bg-white/25 text-white'
                    : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                }`}
              >
                {statusCounts.ready}
              </span>
            </button>

            {/* Overdue (>20 min) */}
            {statusCounts.overdue > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
                className={`
                  px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all
                  ${
                    statusFilter === 'overdue'
                      ? 'bg-rose-600 text-white shadow-2xs ring-2 ring-rose-400'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 border border-rose-300 dark:border-rose-800 animate-pulse'
                  }
                `}
              >
                <AlertTriangle size={13} />
                <span>{t('kitchen.statusOverdue', 'Overdue')}</span>
                <span
                  className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                    statusFilter === 'overdue'
                      ? 'bg-white/25 text-white'
                      : 'bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100'
                  }`}
                >
                  {statusCounts.overdue}
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 shrink-0">
            <Clock size={13} />
            <span>5s Auto-sync</span>
          </div>
        </div>
      </header>

      {/* KOT Main Surface */}
      <main className="flex-1 overflow-y-auto p-4">
        {loading && activeKOTs.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 auto-rows-max items-start">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={`kot-shimmer-${i}`}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between min-h-[220px] shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
                    <div className="shimmer h-5 w-20 rounded" />
                    <div className="shimmer h-5 w-16 rounded-full" />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="shimmer h-4 w-24 rounded" />
                    <div className="shimmer h-3.5 w-12 rounded" />
                  </div>
                  <div className="mt-4 space-y-2.5">
                    <div className="shimmer h-4 w-3/4 rounded" />
                    <div className="shimmer h-4 w-1/2 rounded" />
                    <div className="shimmer h-3.5 w-2/3 rounded" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex gap-2">
                  <div className="shimmer h-9 w-full rounded-lg" />
                  <div className="shimmer h-9 w-12 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : displayedKOTs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500">
            <MonitorPlay size={64} className="mb-4 opacity-40 text-blue-500" />
            <p className="text-xl font-medium text-gray-700 dark:text-slate-300">
              {statusFilter !== 'all'
                ? `No orders matching status filter`
                : t('kitchen.noActiveOrders')}
            </p>
            <p className="text-sm mt-1 text-gray-500 dark:text-slate-400">
              {statusFilter !== 'all' ? (
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  View all active orders ({filteredKOTs.length})
                </button>
              ) : (
                t('kitchen.noActiveOrdersDesc')
              )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 auto-rows-max items-start">
            {displayedKOTs.map((kot) => (
              <KOTCard
                key={kot.id}
                kot={kot}
                onUpdateStatus={handleUpdateStatus}
              />
            ))}
          </div>
        )}
      </main>

      {/* Completed KOTs (collapsible) */}
      {completedKOTs.length > 0 && (
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full flex items-center justify-between px-6 py-2.5 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800/80 transition-colors text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-gray-700 dark:text-slate-300 font-semibold text-xs tracking-wide">
                {t('kitchen.recentlyCompleted', { count: completedKOTs.length })}
              </span>
            </div>
            {showCompleted ? (
              <ChevronUp size={16} className="text-gray-400 dark:text-slate-500" />
            ) : (
              <ChevronDown size={16} className="text-gray-400 dark:text-slate-500" />
            )}
          </button>

          {showCompleted && (
            <div className="bg-gray-50/90 dark:bg-slate-900/60 px-5 py-3 max-h-56 overflow-y-auto border-t border-gray-100 dark:border-slate-800/80">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {completedKOTs.map((kot) => (
                  <div
                    key={kot.id}
                    className="bg-white dark:bg-slate-800/90 rounded-xl px-3 py-2 border border-gray-200/80 dark:border-slate-700/60 shadow-2xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-900 dark:text-white font-bold text-sm">
                        #{kot.kotNumber}
                      </span>
                      <span className="text-[11px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded font-semibold">
                        {t('kitchen.served')}
                      </span>
                    </div>
                    <div className="text-gray-600 dark:text-slate-400 text-xs truncate">
                      {t('kitchen.orderNumberPrefix', { number: kot.orderNumber })}
                      {kot.tableName && ` - ${kot.tableName}`}
                    </div>
                    <div className="text-gray-400 dark:text-slate-500 text-[11px] mt-0.5">
                      {t('kitchen.itemCount', { count: kot.items.length })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KitchenDisplay;
