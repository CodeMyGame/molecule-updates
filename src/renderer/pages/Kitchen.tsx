import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MonitorPlay,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useKOTStore } from '../stores/kot.store';
import { KOTStatus } from '../../shared/enums';
import KOTCard from '../components/kitchen/KOTCard';
import StationFilter from '../components/kitchen/StationFilter';

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
    startAutoRefresh,
    stopAutoRefresh,
  } = useKOTStore();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [showCompleted, setShowCompleted] = useState(false);
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

  // Clock update every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Detect newly-arrived KOTs from polling diffs and play a sound.
  // Works in both Electron and browser modes, doesn't depend on push events.
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
          // Will only succeed if the user has already interacted with the page.
          ctx.resume().catch(() => {});
        }
        if (ctx.state !== 'running') return;

        const t0 = ctx.currentTime;
        const DURATION = 2.0;

        // Two oscillators stacked an octave apart for a richer, louder timbre
        // that cuts through kitchen background noise.
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

  const handleUpdateStatus = (id: number, status: KOTStatus) => {
    updateKOTStatus(id, status);
  };

  const timeString = currentTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <div className="h-full flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <MonitorPlay size={28} className="text-blue-400" />
          <h1 className="text-xl font-bold tracking-tight">{t('kitchen.title')}</h1>
        </div>

        <StationFilter
          selectedStation={selectedStation}
          onSelect={setStation}
          counts={stationCounts}
        />

        <div className="flex items-center gap-4">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
            title={soundEnabled ? t('kitchen.muteSound') : t('kitchen.unmuteSound')}
          >
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button
            onClick={fetchKOTs}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white disabled:opacity-50"
            title={t('common.refresh')}
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="text-right">
            <div className="text-2xl font-mono font-bold text-white tabular-nums">
              {timeString}
            </div>
          </div>
        </div>
      </header>

      {/* KOT Grid */}
      <main className="flex-1 overflow-y-auto p-4">
        {filteredKOTs.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <MonitorPlay size={64} className="mb-4 opacity-30" />
            <p className="text-xl font-medium">{t('kitchen.noActiveOrders')}</p>
            <p className="text-sm mt-1">{t('kitchen.noActiveOrdersDesc')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-auto">
            {filteredKOTs.map((kot) => (
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
        <div className="flex-shrink-0 border-t border-gray-800">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full flex items-center justify-between px-6 py-2.5 bg-gray-900 hover:bg-gray-800 transition-colors text-sm"
          >
            <span className="text-gray-400 font-medium">
              {t('kitchen.recentlyCompleted', { count: completedKOTs.length })}
            </span>
            {showCompleted ? (
              <ChevronUp size={18} className="text-gray-500" />
            ) : (
              <ChevronDown size={18} className="text-gray-500" />
            )}
          </button>

          {showCompleted && (
            <div className="bg-gray-900/50 px-4 py-3 max-h-60 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {completedKOTs.map((kot) => (
                  <div
                    key={kot.id}
                    className="bg-gray-800/60 rounded-lg px-3 py-2 border border-gray-700/40"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-bold text-sm">
                        #{kot.kotNumber}
                      </span>
                      <span className="text-xs bg-green-800 text-green-300 px-1.5 py-0.5 rounded-full font-medium">
                        {t('kitchen.served')}
                      </span>
                    </div>
                    <div className="text-gray-400 text-xs">
                      {t('kitchen.orderNumberPrefix', { number: kot.orderNumber })}
                      {kot.tableName && ` - ${kot.tableName}`}
                    </div>
                    <div className="text-gray-500 text-xs mt-0.5">
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
