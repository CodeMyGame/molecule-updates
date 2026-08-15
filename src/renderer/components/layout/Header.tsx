import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  LogOut,
  Banknote,
  CreditCard,
  Smartphone,
  Bell,
  TrendingUp,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  AlertTriangle,
  ChevronRight,
  Sun,
  Flame,
  ArrowUpRight,
  BarChart2,
  Package,
  Download,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import toast from 'react-hot-toast';
import { useBillingStore } from '../../stores/billing.store';
import { useDaySessionStore } from '../../stores/daySession.store';
import { useSettings } from '../../hooks/useSettings';
import { ipc } from '../../lib/ipc';
import { formatCurrency } from '../../lib/formatters';
import Modal from '../common/Modal';
import Button from '../common/Button';

const Header: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuthStore();
  const clearCart = useBillingStore((s) => s.clearCart);
  const cartLength = useBillingStore((s) => s.cart.length);
  const syncedItemCount = useBillingStore((s) => s.syncedItemCount);
  const isDayOpen = useDaySessionStore((s) => s.isDayOpen);
  const currentSession = useDaySessionStore((s) => s.currentSession);
  const fetchDaySession = useDaySessionStore((s) => s.fetch);
  const { restaurant, fetchRestaurant } = useSettings();
  useEffect(() => { void fetchRestaurant(); }, [fetchRestaurant]);
  const restaurantName = restaurant?.name?.trim() || t('header.appName');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [shiftReport, setShiftReport] = useState<any>(null);
  const [showShiftReport, setShowShiftReport] = useState(false);

  const [updateState, setUpdateState] = useState<'idle' | 'available' | 'downloading' | 'ready'>('idle');
  const [updateVersion, setUpdateVersion] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [appVersion, setAppVersion] = useState('');
  const [showBellMenu, setShowBellMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'yesterday' | 'today'>('yesterday');
  const [yesterdayData, setYesterdayData] = useState<any>(null);
  const [todayData, setTodayData] = useState<any>(null);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);

  useEffect(() => {
    if (!window.electronAPI?.updater) return;

    ipc<string>(window.electronAPI.updater.getVersion())
      .then((v) => { if (v) setAppVersion(v); })
      .catch(() => {});

    const unsub1 = window.electronAPI.updater.onUpdateAvailable((info: any) => {
      setUpdateVersion(info.version);
      setUpdateState('available');
    });
    const unsub2 = window.electronAPI.updater.onDownloadProgress((p: any) => {
      setUpdateState('downloading');
      setDownloadProgress(Math.round(p?.percent ?? 0));
    });
    const unsub3 = window.electronAPI.updater.onUpdateDownloaded((info: any) => {
      setUpdateVersion(info.version);
      setUpdateState('ready');
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, []);

  const getFormattedDates = () => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const yesterdayLabel = yesterday.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

    return { todayStr, yesterdayStr, yesterdayLabel };
  };

  const fetchStats = useCallback(async () => {
    if (!window.electronAPI?.reports) return;
    setLoadingStats(true);
    try {
      const { todayStr, yesterdayStr } = getFormattedDates();

      const [yesterdayRes, todayRes, lowStockRes] = await Promise.allSettled([
        ipc<any>(window.electronAPI.reports.dayEndSummary({ startDate: yesterdayStr, endDate: yesterdayStr })),
        ipc<any>(window.electronAPI.reports.dayEndSummary({ startDate: todayStr, endDate: todayStr })),
        window.electronAPI.inventory?.getLowStock ? ipc<any[]>(window.electronAPI.inventory.getLowStock()) : Promise.resolve([]),
      ]);

      if (yesterdayRes.status === 'fulfilled' && yesterdayRes.value) {
        setYesterdayData(yesterdayRes.value);
      }
      if (todayRes.status === 'fulfilled' && todayRes.value) {
        setTodayData(todayRes.value);
      }
      if (lowStockRes.status === 'fulfilled' && Array.isArray(lowStockRes.value)) {
        setLowStockCount(lowStockRes.value.length);
      }
    } catch (err) {
      console.error('Failed to fetch heads up stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleToggleBell = () => {
    if (!showBellMenu) {
      fetchStats();
    }
    setShowBellMenu((prev) => !prev);
  };

  useEffect(() => {
    fetchDaySession();
  }, [fetchDaySession]);
  const [slotHasContent, setSlotHasContent] = useState(false);
  const slotRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById('header-center-slot');
    if (!el) return;
    slotRef.current = el;
    const observer = new MutationObserver(() => {
      setSlotHasContent(el.childNodes.length > 0);
    });
    observer.observe(el, { childList: true });
    setSlotHasContent(el.childNodes.length > 0);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const pageTitle = useMemo(() => {
    const routes: Record<string, string> = {
      '/billing': t('nav.billing'),
      '/tables': t('tables.title'),
      '/menu': t('menu.menuManagement'),
      '/inventory': t('nav.inventory'),
      '/staff': t('staff.title'),
      '/reports': t('nav.reports'),
      '/customers': t('nav.customers'),
      '/kitchen': t('kitchen.title'),
      '/settings': t('nav.settings'),
    };
    return routes[location.pathname] ?? t('header.appName');
  }, [location.pathname, t]);

  const formattedDate = currentTime.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const formattedTime = currentTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const { yesterdayLabel } = getFormattedDates();
  const hasAlerts = updateState !== 'idle' || lowStockCount > 0;

  return (
    <>
    <header className="pos-header">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100 tracking-tight whitespace-nowrap leading-none">
          {restaurantName}
        </span>
      </div>

      {/* Center slot: pages can portal content here; fallback shows clock */}
      <div className="flex-1 flex items-center justify-center min-w-0">
        <div id="header-center-slot" className="flex items-center gap-1.5 overflow-x-auto max-w-full" />
        <div className={`flex items-center gap-3 ${slotHasContent ? 'hidden' : ''}`}>
          <div className="flex items-center gap-1 text-[10px] text-gray-600 leading-none">
            <Clock size={10} />
            <span>{formattedDate}</span>
            <span className="font-mono font-medium text-gray-800">{formattedTime}</span>
          </div>
          <div className="flex items-center gap-1 leading-none">
            <div className={`w-1.5 h-1.5 rounded-full ${isDayOpen ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`} />
            <span className={`text-[9px] font-medium ${isDayOpen ? 'text-green-700' : 'text-red-600'}`}>
              {isDayOpen ? t('header.dayOpen') : t('header.dayClosed')}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Daily Heads-Up & Notification Menu */}
        <div className="relative flex items-center">
          <button
            onClick={handleToggleBell}
            className={`relative flex items-center justify-center w-5 h-5 rounded transition-colors ${
              showBellMenu
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                : hasAlerts
                ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700'
            }`}
            title={t('header.dailyHeadsUp', 'Daily Heads-Up & Notifications')}
          >
            <Bell size={12} className={hasAlerts ? 'animate-bounce' : ''} />
            {hasAlerts && (
              <span className="absolute 0 top-0 right-0 flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
              </span>
            )}
          </button>

          {showBellMenu && createPortal(
            <>
              {/* Backdrop to close menu on outside click */}
              <div
                className="fixed inset-0 z-[99998] cursor-default bg-black/20 backdrop-blur-[0.5px]"
                onClick={() => setShowBellMenu(false)}
              />

              {/* Context Dropdown Menu */}
              <div className="fixed top-8 right-2 w-[380px] max-w-[92vw] bg-white border border-gray-200 rounded-2xl shadow-2xl z-[99999] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Header with Title and Refresh */}
                <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-blue-50/40 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-600 text-white rounded-lg shadow-xs">
                      <Sparkles size={14} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1.5">
                        {t('header.dailyHeadsUp', 'Daily Heads-Up')}
                      </h3>
                      <p className="text-[10px] text-gray-500">Quick snapshot & business pulse</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fetchStats();
                    }}
                    className={`p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/80 border border-transparent hover:border-gray-200 transition ${
                      loadingStats ? 'animate-spin text-blue-600' : ''
                    }`}
                    title="Refresh data"
                  >
                    <RotateCcw size={13} />
                  </button>
                </div>

                {/* Tab selector */}
                <div className="flex border-b border-gray-100 bg-gray-50/50 p-1 text-xs">
                  <button
                    onClick={() => setActiveTab('yesterday')}
                    className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition text-center flex items-center justify-center gap-1.5 ${
                      activeTab === 'yesterday'
                        ? 'bg-white text-gray-900 shadow-xs border border-gray-200/60'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    <span>{t('header.yesterdayRecap', 'Yesterday')}</span>
                    <span className="text-[10px] font-normal text-gray-400">({yesterdayLabel})</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('today')}
                    className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition text-center flex items-center justify-center gap-1.5 ${
                      activeTab === 'today'
                        ? 'bg-white text-gray-900 shadow-xs border border-gray-200/60'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {t('header.todayLive', 'Today')}
                    </span>
                    <span className="text-[10px] font-normal text-gray-400">(Live)</span>
                  </button>
                </div>

                {/* Tab Content */}
                <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
                  {/* Yesterday Tab Content */}
                  {activeTab === 'yesterday' && (
                    <>
                      {yesterdayData && yesterdayData.totalOrders > 0 ? (
                        <div className="space-y-3">
                          {/* Yesterday Revenue Card */}
                          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 via-teal-50/70 to-blue-50/50 border border-emerald-150/80 shadow-xs">
                            <div className="flex items-center justify-between text-[11px] text-emerald-800 font-semibold uppercase tracking-wider mb-1">
                              <span>{t('header.yesterdayRevenue', "Yesterday's Revenue")}</span>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-900 text-[10px]">
                                {yesterdayData.totalOrders} {yesterdayData.totalOrders === 1 ? 'order' : 'orders'}
                              </span>
                            </div>
                            <div className="text-2xl font-black text-gray-900 tracking-tight">
                              {formatCurrency(yesterdayData.totalRevenue)}
                            </div>
                            <div className="mt-2.5 pt-2.5 border-t border-emerald-200/50 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500 text-[10px] block">{t('header.avgTicket', 'Avg Ticket')}</span>
                                <span className="font-bold text-gray-800">
                                  {formatCurrency(
                                    yesterdayData.totalOrders > 0
                                      ? Math.round(yesterdayData.totalRevenue / yesterdayData.totalOrders)
                                      : 0
                                  )}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500 text-[10px] block">Items Sold</span>
                                <span className="font-bold text-gray-800">
                                  {yesterdayData.totalCovers ?? 0}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Payment Breakdown Bar & List */}
                          {(yesterdayData.paymentBreakdown ?? []).length > 0 && (
                            <div className="p-3 bg-gray-50/80 border border-gray-150 rounded-xl space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-semibold text-gray-700">
                                <span>{t('header.paymentMix', 'Payment Breakdown')}</span>
                                <span className="text-[10px] text-gray-400 font-normal">
                                  {(yesterdayData.paymentBreakdown ?? []).length} modes
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-1.5 pt-1">
                                {(yesterdayData.paymentBreakdown as any[]).map((p) => {
                                  const modeIcon =
                                    p.mode === 'cash' ? <Banknote size={12} className="text-emerald-600" /> :
                                    p.mode === 'card' ? <CreditCard size={12} className="text-blue-600" /> :
                                    <Smartphone size={12} className="text-purple-600" />;

                                  return (
                                    <div key={p.mode} className="bg-white p-2 rounded-lg border border-gray-100 text-center shadow-xs">
                                      <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-gray-600 capitalize">
                                        {modeIcon} {p.mode}
                                      </div>
                                      <div className="text-xs font-bold text-gray-900 mt-0.5 truncate">
                                        {formatCurrency(p.total)}
                                      </div>
                                      <div className="text-[9px] text-gray-400 font-medium">
                                        {p.count} txn
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Top Seller Item */}
                          {(yesterdayData.topItems ?? []).length > 0 && (
                            <div className="flex items-center justify-between p-2.5 bg-amber-50/60 border border-amber-150/70 rounded-xl text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg flex-shrink-0">
                                  <Flame size={14} />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[10px] font-semibold text-amber-800 uppercase block">
                                    {t('header.topSeller', 'Top Seller')}
                                  </span>
                                  <p className="font-bold text-gray-900 truncate">
                                    {yesterdayData.topItems[0].name}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span className="font-bold text-amber-900 text-xs">
                                  {yesterdayData.topItems[0].quantity} sold
                                </span>
                                <span className="text-[10px] text-gray-500 block">
                                  {formatCurrency(yesterdayData.topItems[0].revenue)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-8 text-center space-y-1.5">
                          <div className="w-10 h-10 mx-auto rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                            <BarChart2 size={18} />
                          </div>
                          <p className="text-xs font-semibold text-gray-700">
                            {t('header.noOrdersYesterday', 'No completed orders yesterday')}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            Sales figures will automatically appear after yesterday's day end.
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Today Tab Content */}
                  {activeTab === 'today' && (
                    <div className="space-y-3">
                      {/* Today Live Revenue Card */}
                      <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 via-indigo-50/70 to-purple-50/40 border border-blue-150/80 shadow-xs">
                        <div className="flex items-center justify-between text-[11px] text-blue-800 font-semibold uppercase tracking-wider mb-1">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                            {t('header.todayRevenue', "Today's Revenue (Live)")}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 text-[10px]">
                            {todayData?.totalOrders ?? 0} {(todayData?.totalOrders ?? 0) === 1 ? 'order' : 'orders'}
                          </span>
                        </div>
                        <div className="text-2xl font-black text-gray-900 tracking-tight">
                          {formatCurrency(todayData?.totalRevenue ?? 0)}
                        </div>
                        <div className="mt-2.5 pt-2.5 border-t border-blue-200/50 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500 text-[10px] block">{t('header.avgTicket', 'Avg Ticket')}</span>
                            <span className="font-bold text-gray-800">
                              {formatCurrency(
                                (todayData?.totalOrders ?? 0) > 0
                                  ? Math.round((todayData?.totalRevenue ?? 0) / (todayData?.totalOrders ?? 1))
                                  : 0
                              )}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 text-[10px] block">Day Status</span>
                            <span className={`font-bold flex items-center gap-1 ${isDayOpen ? 'text-emerald-700' : 'text-red-600'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isDayOpen ? 'bg-emerald-500' : 'bg-red-400'}`} />
                              {isDayOpen ? t('header.dayOpen') : t('header.dayClosed')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Today Top Item */}
                      {todayData && (todayData.topItems ?? []).length > 0 && (
                        <div className="p-3 bg-gray-50 border border-gray-150 rounded-xl space-y-1.5">
                          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Leading Item Today
                          </span>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-gray-800">{todayData.topItems[0].name}</span>
                            <span className="font-semibold text-blue-600">{todayData.topItems[0].quantity} sold</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actionable Alerts (Software Update & Low Stock) */}
                  {hasAlerts && (
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Alerts & Actions
                      </p>

                      {/* Software Update Card */}
                      {updateState === 'ready' ? (
                        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-sm space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold text-xs">
                              <Sparkles size={14} className="text-amber-300 animate-pulse" />
                              <span>Software Update Ready (v{updateVersion})</span>
                            </div>
                            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-semibold">Ready</span>
                          </div>
                          <p className="text-[11px] text-blue-100 leading-snug">
                            The update has been downloaded in background. Restart the app to apply it.
                          </p>
                          <button
                            onClick={() => window.electronAPI.updater.installNow()}
                            className="w-full py-1.5 px-3 rounded-lg bg-white hover:bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
                          >
                            <Download size={13} />
                            <span>Restart & Install Update</span>
                          </button>
                        </div>
                      ) : updateState === 'downloading' ? (
                        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-blue-900 font-bold">
                            <span className="flex items-center gap-1.5">
                              <RefreshCw size={13} className="animate-spin text-blue-600" />
                              <span>Downloading Update (v{updateVersion})...</span>
                            </span>
                            <span className="font-mono">{downloadProgress}%</span>
                          </div>
                          <div className="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-blue-600 h-full transition-all duration-200"
                              style={{ width: `${downloadProgress}%` }}
                            />
                          </div>
                        </div>
                      ) : updateState === 'available' ? (
                        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold text-xs text-blue-950">
                              <Sparkles size={14} className="text-blue-600" />
                              <span>New Update Available (v{updateVersion})</span>
                            </div>
                            <span className="text-[10px] bg-blue-200/70 text-blue-800 px-1.5 py-0.5 rounded font-semibold">New</span>
                          </div>
                          <p className="text-[11px] text-blue-800 leading-snug">
                            A new version is available with latest features & improvements.
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                setUpdateState('downloading');
                                try {
                                  await window.electronAPI.updater.downloadUpdate();
                                } catch (err) {
                                  console.error('Download update failed:', err);
                                }
                              }}
                              className="flex-1 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
                            >
                              <Download size={13} />
                              <span>Download Now</span>
                            </button>
                            <button
                              onClick={() => {
                                setShowBellMenu(false);
                                navigate('/settings');
                              }}
                              className="py-1.5 px-2.5 rounded-lg border border-blue-200 bg-white hover:bg-blue-50 text-blue-700 text-xs font-medium transition"
                            >
                              Details
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {/* Low Stock Alert */}
                      {lowStockCount > 0 && (
                        <button
                          onClick={() => {
                            setShowBellMenu(false);
                            navigate('/inventory');
                          }}
                          className="w-full text-left p-2.5 rounded-xl bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200 transition flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="p-1.5 bg-amber-600 text-white rounded-lg flex-shrink-0">
                              <AlertTriangle size={13} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-amber-950 truncate">
                                {lowStockCount} {lowStockCount === 1 ? 'item' : 'items'} Low on Stock
                              </p>
                              <p className="text-[10px] text-amber-800">Check inventory to reorder</p>
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-amber-500 flex-shrink-0" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer: Link to Full Reports */}
                <div className="p-2.5 bg-gray-50 border-t border-gray-150 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setShowBellMenu(false);
                      navigate('/reports');
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-gray-200/80 text-xs font-semibold text-gray-700 transition flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>{t('header.viewDetailedReports', 'View Detailed Reports')}</span>
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>
            </>,
            document.body
          )}
        </div>
      </div>
    </header>

    {/* Shift Handover Modal */}
    <Modal
      isOpen={showShiftReport}
      onClose={() => setShowShiftReport(false)}
      title={t('header.shiftHandover')}
      size="md"
      footer={
        <Button variant="danger" icon={<LogOut size={16} />} onClick={() => { setShowShiftReport(false); logout(); }}>
          {t('nav.logout')}
        </Button>
      }
    >
      {shiftReport && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {t('header.summaryFor', { name: shiftReport.staffName })}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-blue-900">{shiftReport.totalOrders}</p>
              <p className="text-xs text-blue-600">{t('header.ordersHandled')}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-green-900">{formatCurrency(shiftReport.totalRevenue)}</p>
              <p className="text-xs text-green-600">{t('header.totalRevenue')}</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">{t('header.collections')}</h4>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-600"><Banknote size={14} className="text-green-600" /> {t('header.cash')}</span>
              <span className="font-medium">{formatCurrency(shiftReport.cashCollected)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-600"><CreditCard size={14} className="text-blue-600" /> {t('header.card')}</span>
              <span className="font-medium">{formatCurrency(shiftReport.cardCollected)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-600"><Smartphone size={14} className="text-purple-600" /> {t('header.upi')}</span>
              <span className="font-medium">{formatCurrency(shiftReport.upiCollected)}</span>
            </div>
          </div>

          {(shiftReport.ordersByType ?? []).length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('header.ordersByType')}</h4>
              <div className="flex gap-4 text-sm">
                {shiftReport.ordersByType.map((ot: any) => (
                  <span key={ot.type} className="text-gray-600 capitalize">
                    {ot.type.replace('_', ' ')}: <span className="font-medium">{ot.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
    </>
  );
};

export default Header;
