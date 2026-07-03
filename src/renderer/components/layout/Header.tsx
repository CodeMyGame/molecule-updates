import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, LogOut, Banknote, CreditCard, Smartphone } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
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
  const { currentUser, logout } = useAuthStore();
  const clearCart = useBillingStore((s) => s.clearCart);
  const cartLength = useBillingStore((s) => s.cart.length);
  const syncedItemCount = useBillingStore((s) => s.syncedItemCount);
  const isDayOpen = useDaySessionStore((s) => s.isDayOpen);
  const fetchDaySession = useDaySessionStore((s) => s.fetch);
  const { restaurant, fetchRestaurant } = useSettings();
  useEffect(() => { void fetchRestaurant(); }, [fetchRestaurant]);
  const restaurantName = restaurant?.name?.trim() || t('header.appName');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [shiftReport, setShiftReport] = useState<any>(null);
  const [showShiftReport, setShowShiftReport] = useState(false);

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

  return (
    <>
    <header className="pos-header">
      <div className="pos-header-pattern" aria-hidden="true" />
      <div className="flex items-center gap-3 min-w-0">
        <span className="pos-header-float-text text-sm font-bold tracking-wide whitespace-nowrap">
          {Array.from(restaurantName).map((ch, i) => (
            <span
              key={i}
              className="pos-header-float-char"
              style={{ animationDelay: `${(i * 0.18).toFixed(2)}s` }}
            >
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </span>
      </div>

      {/* Center slot: pages can portal content here; fallback shows clock */}
      <div className="flex-1 flex items-center justify-center min-w-0">
        <div id="header-center-slot" className="flex items-center gap-2 overflow-x-auto max-w-full" />
        <div className={`flex items-center gap-4 ${slotHasContent ? 'hidden' : ''}`}>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
            <Clock size={12} />
            <span>{formattedDate}</span>
            <span className="font-mono font-medium text-gray-800">{formattedTime}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${isDayOpen ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`} />
            <span className={`text-[10px] font-medium ${isDayOpen ? 'text-green-700' : 'text-red-600'}`}>
              {isDayOpen ? t('header.dayOpen') : t('header.dayClosed')}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2" />
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
