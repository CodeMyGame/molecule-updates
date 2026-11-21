import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Receipt,
  LayoutGrid,
  UtensilsCrossed,
  Package,
  ChefHat,
  Users,
  UserCog,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Plus,
  Sun,
  Moon,
  QrCode,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../stores/auth.store';
import { useBillingStore } from '../../stores/billing.store';
import { useDaySessionStore } from '../../stores/daySession.store';
import { useUIStore } from '../../stores/ui.store';
import { ipc } from '../../lib/ipc';
import Tooltip from '../common/Tooltip';
import { useTranslation } from 'react-i18next';
import { currencySymbolForLanguage } from '../../lib/currencyLocale';

interface NavItem {
  key: string;
  path: string;
  icon: React.ReactNode;
}

interface NavGroup {
  groupKey: string;
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupKey: 'pos',
    label: 'Point of Sale',
    items: [
      { key: 'billing', path: '/billing', icon: <Receipt size={17} /> },
      { key: 'tables', path: '/tables', icon: <LayoutGrid size={17} /> },
      { key: 'kitchen', path: '/kitchen', icon: <ChefHat size={17} /> },
    ],
  },
  {
    groupKey: 'catalog',
    label: 'Menu & Stock',
    items: [
      { key: 'menu', path: '/menu', icon: <UtensilsCrossed size={17} /> },
      { key: 'qrMenu', path: '/qr-menu', icon: <QrCode size={17} /> },
      { key: 'inventory', path: '/inventory', icon: <Package size={17} /> },
    ],
  },
  {
    groupKey: 'management',
    label: 'Management',
    items: [
      { key: 'customers', path: '/customers', icon: <Users size={17} /> },
      { key: 'staff', path: '/staff', icon: <UserCog size={17} /> },
      { key: 'reports', path: '/reports', icon: <BarChart3 size={17} /> },
      { key: 'settings', path: '/settings', icon: <Settings size={17} /> },
    ],
  },
];

const Sidebar: React.FC = () => {
  const { currentUser, logout } = useAuthStore();
  const clearCart = useBillingStore((s) => s.clearCart);
  const cartLength = useBillingStore((s) => s.cart.length);
  const syncedItemCount = useBillingStore((s) => s.syncedItemCount);
  const isDayOpen = useDaySessionStore((s) => s.isDayOpen);
  const fetchDaySession = useDaySessionStore((s) => s.fetch);
  const setDaySession = useDaySessionStore((s) => s.setSession);
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const getGroupLabel = (groupKey: string): string => {
    switch (groupKey) {
      case 'pos': return t('nav.groupPos', 'Point of Sale');
      case 'catalog': return t('nav.groupCatalog', 'Menu & Stock');
      case 'management': return t('nav.groupManagement', 'Management');
      default: return '';
    }
  };

  useEffect(() => {
    fetchDaySession();
  }, [fetchDaySession]);

  const handleNewOrder = () => {
    const hasUnsyncedItems = cartLength > syncedItemCount;
    if (hasUnsyncedItems && !window.confirm(t('header.discardOrder'))) return;
    clearCart();
    navigate('/billing');
  };

  const handleDayToggle = async () => {
    try {
      if (isDayOpen) {
        await ipc(window.electronAPI.daySession.close({ closingCash: 0 }));
        setDaySession(null);
        toast.success(t('toast.dayClosed'));
      } else {
        const session = await ipc<any>(window.electronAPI.daySession.open({ openingCash: 0 }));
        setDaySession(session);
        toast.success(t('toast.dayOpened'));
      }
    } catch (err: any) {
      toast.error(err?.message ?? t('toast.daySessionFailed'));
    }
  };

  const [logoutModal, setLogoutModal] = useState<{ orders: number; revenue: number; error?: boolean } | null>(null);

  const handleLogout = async () => {
    if (!currentUser) { logout(); return; }
    try {
      const today = new Date().toISOString().split('T')[0];
      const report = await ipc<any>(window.electronAPI.reports.shiftHandover(currentUser.id, {
        startDate: today,
        endDate: today,
      }));
      setLogoutModal({ orders: report?.totalOrders ?? 0, revenue: report?.totalRevenue ?? 0 });
    } catch {
      setLogoutModal({ orders: 0, revenue: 0, error: true });
    }
  };

  const confirmLogout = () => {
    setLogoutModal(null);
    logout();
  };

  return (
    <aside
      className={`pos-sidebar transition-all duration-200 z-30 relative select-none ${
        sidebarCollapsed ? 'w-16' : 'w-52'
      }`}
    >
      {/* Restaurant branding + toggle */}
      <div className="px-3.5 py-2.5 border-b border-gray-800 flex items-center justify-between">
        {sidebarCollapsed ? (
          <Tooltip text={t('nav.expandSidebar')} position="right" className="w-full">
            <button
              onClick={toggleSidebar}
              title={t('nav.expandSidebar')}
              className="w-full flex items-center justify-center py-1 text-gray-400 hover:text-white transition-colors"
            >
              <Menu size={18} />
            </button>
          </Tooltip>
        ) : (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-xs shadow-xs">
                M
              </div>
              <span className="text-sm font-bold text-white tracking-tight truncate">
                Molecule POS
              </span>
            </div>
            <Tooltip text={t('nav.collapseSidebar')} position="bottom">
              <button
                onClick={toggleSidebar}
                title={t('nav.collapseSidebar')}
                className="p-1 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
              >
                <Menu size={16} />
              </button>
            </Tooltip>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav data-tour="sidebar-nav" className="flex-1 py-1.5 overflow-y-auto no-scrollbar">
        {NAV_GROUPS.map((group, groupIdx) => (
          <div key={group.groupKey} className="mb-2">
            {!sidebarCollapsed && (
              <div className="px-3.5 pt-2.5 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {getGroupLabel(group.groupKey)}
              </div>
            )}
            {sidebarCollapsed && groupIdx > 0 && (
              <div className="border-t border-gray-800/80 my-1.5 mx-3" />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                sidebarCollapsed ? (
                  <Tooltip key={item.path} text={t(`nav.${item.key}`)} position="right" className="w-full block">
                    <NavLink
                      to={item.path}
                      title={t(`nav.${item.key}`)}
                      className={({ isActive }) =>
                        `flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition-all duration-150 ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-gray-400 hover:bg-gray-800/80 hover:text-white'
                        }`
                      }
                    >
                      <span className="w-5 h-5 flex items-center justify-center shrink-0">
                        {item.icon}
                      </span>
                    </NavLink>
                  </Tooltip>
                ) : (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-2 mx-2 rounded-xl transition-all duration-150 min-h-[38px] ${
                        isActive
                          ? 'bg-blue-600 text-white font-medium shadow-xs'
                          : 'text-gray-300 hover:bg-gray-800/80 hover:text-white'
                      }`
                    }
                  >
                    <span className="w-5 h-5 flex items-center justify-center shrink-0">
                      {item.icon}
                    </span>
                    <span className="text-xs tracking-tight">{t(`nav.${item.key}`)}</span>
                  </NavLink>
                )
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Action buttons */}
      <div data-tour="day-session-toggle" className="border-t border-gray-800/80 px-2.5 py-2 flex flex-col gap-1.5 bg-gray-950/40">
        {sidebarCollapsed ? (
          <>
            <Tooltip text={t('header.newOrder')} position="right" className="w-full">
              <button
                onClick={handleNewOrder}
                title={t('header.newOrder')}
                className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 transition-colors shadow-xs"
              >
                <Plus size={16} />
              </button>
            </Tooltip>
            <Tooltip text={isDayOpen ? t('header.closeDay') : t('header.openDay')} position="right" className="w-full">
              <button
                onClick={handleDayToggle}
                title={isDayOpen ? t('header.closeDay') : t('header.openDay')}
                className={`flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition-colors ${
                  isDayOpen
                    ? 'text-red-400 hover:bg-red-950/40 border border-red-900/30'
                    : 'text-emerald-400 hover:bg-emerald-950/40 border border-emerald-900/30'
                }`}
              >
                {isDayOpen ? <Moon size={15} /> : <Sun size={15} />}
              </button>
            </Tooltip>
          </>
        ) : (
          <>
            <button
              onClick={handleNewOrder}
              className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 transition-all shadow-xs"
            >
              <Plus size={14} />
              <span>{t('header.newOrder')}</span>
            </button>
            <button
              onClick={handleDayToggle}
              className={`flex items-center justify-between w-full py-1.5 px-3 rounded-xl text-xs font-medium border transition-colors ${
                isDayOpen
                  ? 'text-red-300 bg-red-950/20 hover:bg-red-950/40 border-red-800/40'
                  : 'text-emerald-300 bg-emerald-950/20 hover:bg-emerald-950/40 border-emerald-800/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${isDayOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
                <span>{isDayOpen ? t('header.closeDay') : t('header.openDay')}</span>
              </div>
              {isDayOpen ? <Moon size={13} className="text-red-400" /> : <Sun size={13} className="text-emerald-400" />}
            </button>
          </>
        )}
      </div>

      {/* Current user */}
      <div className="border-t border-gray-800/80 px-2.5 py-2.5 bg-gray-950/60">
        {sidebarCollapsed ? (
          <Tooltip text={`${currentUser?.name ?? t('common.unknown')} (${t('nav.logout')})`} position="right" className="w-full">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center py-1 text-gray-400 hover:text-red-400 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-gray-200 hover:border-red-500 transition-colors">
                {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            </button>
          </Tooltip>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-700 to-indigo-600 border border-blue-400/30 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate leading-tight">
                  {currentUser?.name ?? t('common.unknown')}
                </p>
                <span className="inline-block text-[10px] font-medium text-gray-400 capitalize truncate">
                  {currentUser?.role ?? ''}
                </span>
              </div>
            </div>
            <Tooltip text={t('nav.logout')} position="top">
              <button
                onClick={handleLogout}
                title={t('nav.logout')}
                className="p-1.5 text-gray-400 hover:text-red-400 transition-colors rounded-lg hover:bg-gray-800 shrink-0"
              >
                <LogOut size={15} />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
      {/* Logout confirmation modal */}
      {logoutModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs" onClick={() => setLogoutModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 w-[340px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gray-50 dark:bg-gray-900 px-6 pt-5 pb-4 text-center border-b border-gray-100 dark:border-gray-700">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 flex items-center justify-center mx-auto mb-3">
                <LogOut size={22} className="text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t('sidebar.endShiftLogout')}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{currentUser?.name ?? t('sidebar.userFallback')}</p>
            </div>

            {/* Shift summary */}
            <div className="px-6 py-4">
              {logoutModal.error ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">{t('sidebar.shiftReportError')}</p>
              ) : logoutModal.orders > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{t('sidebar.shiftSummary')}</p>
                  <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-900/60 rounded-lg">
                    <span className="text-sm text-gray-600 dark:text-gray-300">{t('sidebar.ordersHandled')}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{logoutModal.orders}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-900/60 rounded-lg">
                    <span className="text-sm text-gray-600 dark:text-gray-300">{t('common.revenue')}</span>
                    <span className="text-sm font-semibold text-green-600 dark:text-emerald-400">
                      {currencySymbolForLanguage(i18n.language)}{(logoutModal.revenue / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">{t('sidebar.noOrdersShift')}</p>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={() => setLogoutModal(null)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 border border-transparent dark:border-gray-600 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
              >
                {t('nav.logout')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </aside>
  );
};

export default Sidebar;
