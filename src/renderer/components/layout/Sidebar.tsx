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

const NAV_KEYS = [
  { key: 'billing' as const, path: '/billing', icon: <Receipt size={16} /> },
  { key: 'tables' as const, path: '/tables', icon: <LayoutGrid size={16} /> },
  { key: 'menu' as const, path: '/menu', icon: <UtensilsCrossed size={16} /> },
  { key: 'inventory' as const, path: '/inventory', icon: <Package size={16} /> },
  { key: 'kitchen' as const, path: '/kitchen', icon: <ChefHat size={16} /> },
  { key: 'customers' as const, path: '/customers', icon: <Users size={16} /> },
  { key: 'staff' as const, path: '/staff', icon: <UserCog size={16} /> },
  { key: 'reports' as const, path: '/reports', icon: <BarChart3 size={16} /> },
  { key: 'settings' as const, path: '/settings', icon: <Settings size={16} /> },
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
      className={`pos-sidebar transition-all duration-200 ${
        sidebarCollapsed ? 'w-14' : 'w-36'
      }`}
    >
      {/* Restaurant name + toggle */}
      <div className="px-3 py-2.5 border-b border-gray-700 flex items-center justify-between">
        {sidebarCollapsed ? (
          <Tooltip text={t('nav.expandSidebar')} position="right">
            <button
              onClick={toggleSidebar}
              className="w-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              <Menu size={16} />
            </button>
          </Tooltip>
        ) : (
          <>
            <h1 className="text-sm font-bold text-white truncate">Molecule</h1>
            <Tooltip text={t('nav.collapseSidebar')} position="bottom">
              <button
                onClick={toggleSidebar}
                className="p-0.5 text-gray-400 hover:text-white transition-colors rounded-md hover:bg-gray-800"
              >
                <Menu size={16} />
              </button>
            </Tooltip>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-1 overflow-y-auto">
        {NAV_KEYS.map((item) => (
          sidebarCollapsed ? (
            <Tooltip key={item.path} text={t(`nav.${item.key}`)} position="right">
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 py-2 mx-1.5 my-px rounded-md transition-colors duration-150 tap-target justify-center px-1.5 ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                  {item.icon}
                </span>
              </NavLink>
            </Tooltip>
          ) : (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 mx-1.5 my-px rounded-md transition-colors duration-150 min-h-[36px] justify-start ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                {item.icon}
              </span>
              <span className="text-xs font-medium">{t(`nav.${item.key}`)}</span>
            </NavLink>
          )
        ))}
      </nav>

      {/* Action buttons */}
      <div className="border-t border-gray-700 px-1.5 py-1.5 flex flex-col gap-1">
        {sidebarCollapsed ? (
          <>
            <Tooltip text={t('header.newOrder')} position="right">
              <button
                onClick={handleNewOrder}
                className="flex items-center justify-center w-full py-1.5 rounded-md text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-colors"
              >
                <Plus size={14} />
              </button>
            </Tooltip>
            <Tooltip text={isDayOpen ? t('header.closeDay') : t('header.openDay')} position="right">
              <button
                onClick={handleDayToggle}
                className={`flex items-center justify-center w-full py-1.5 rounded-md transition-colors
                  ${isDayOpen
                    ? 'text-red-400 hover:bg-red-900/30'
                    : 'text-green-400 hover:bg-green-900/30'
                  }`}
              >
                {isDayOpen ? <Moon size={14} /> : <Sun size={14} />}
              </button>
            </Tooltip>
          </>
        ) : (
          <>
            <button
              onClick={handleNewOrder}
              className="flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-colors"
            >
              <Plus size={13} />
              {t('header.newOrder')}
            </button>
            <button
              onClick={handleDayToggle}
              className={`flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors
                ${isDayOpen
                  ? 'text-red-400 hover:bg-red-900/30'
                  : 'text-green-400 hover:bg-green-900/30'
                }`}
            >
              {isDayOpen ? <Moon size={13} /> : <Sun size={13} />}
              {isDayOpen ? t('header.closeDay') : t('header.openDay')}
            </button>
          </>
        )}
      </div>

      {/* Current user */}
      <div className="border-t border-gray-700 px-3 py-2">
        {sidebarCollapsed ? (
          <Tooltip text={t('nav.logout')} position="right">
            <button
              onClick={handleLogout}
              className="flex items-center justify-center w-full tap-target text-gray-400 hover:text-red-400 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </Tooltip>
        ) : (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">
                {currentUser?.name ?? t('common.unknown')}
              </p>
              <p className="text-[10px] text-gray-400 truncate">
                {currentUser?.role ?? ''}
              </p>
            </div>
            <Tooltip text={t('nav.logout')} position="top">
              <button
                onClick={handleLogout}
                className="p-1.5 text-gray-400 hover:text-red-400 transition-colors rounded-md hover:bg-gray-800"
              >
                <LogOut size={14} />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
      {/* Logout confirmation modal */}
      {logoutModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={() => setLogoutModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[340px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gray-50 px-6 pt-5 pb-4 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <LogOut size={22} className="text-red-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{t('sidebar.endShiftLogout')}</h3>
              <p className="text-xs text-gray-500 mt-1">{currentUser?.name ?? t('sidebar.userFallback')}</p>
            </div>

            {/* Shift summary */}
            <div className="px-6 py-4">
              {logoutModal.error ? (
                <p className="text-sm text-gray-500 text-center">{t('sidebar.shiftReportError')}</p>
              ) : logoutModal.orders > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{t('sidebar.shiftSummary')}</p>
                  <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">{t('sidebar.ordersHandled')}</span>
                    <span className="text-sm font-semibold text-gray-900">{logoutModal.orders}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">{t('common.revenue')}</span>
                    <span className="text-sm font-semibold text-green-600">
                      {currencySymbolForLanguage(i18n.language)}{(logoutModal.revenue / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center">{t('sidebar.noOrdersShift')}</p>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={() => setLogoutModal(null)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
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
