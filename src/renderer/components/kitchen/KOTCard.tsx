import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Clock,
  PlayCircle,
  CheckCircle2,
  Truck,
  UtensilsCrossed,
  ShoppingBag,
  Hash,
  Printer,
  Check,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { KOTStatus } from '../../../shared/enums';
import type { KOT } from '../../stores/kot.store';
import { ipc } from '../../lib/ipc';
import { useSharedTicker } from '../../hooks/useSharedTimer';

interface KOTCardProps {
  kot: KOT;
  onUpdateStatus: (id: number, status: KOTStatus) => void;
}

function getElapsedSeconds(createdAt: string): number {
  if (!createdAt) return 0;
  const ts = createdAt.endsWith('Z') ? createdAt : createdAt.replace(' ', 'T') + 'Z';
  const created = new Date(ts).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - created) / 1000));
}

function getUrgencyColor(seconds: number): {
  border: string;
  timerBadge: string;
  headerBg: string;
  isOverdue: boolean;
} {
  const mins = Math.floor(seconds / 60);
  if (mins < 10) {
    return {
      border: 'border-emerald-500/80 dark:border-emerald-500/60',
      timerBadge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
      headerBg: 'bg-emerald-500/5 dark:bg-emerald-950/20',
      isOverdue: false,
    };
  }
  if (mins < 20) {
    return {
      border: 'border-amber-500/90 dark:border-amber-500/70',
      timerBadge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800',
      headerBg: 'bg-amber-500/5 dark:bg-amber-950/20',
      isOverdue: false,
    };
  }
  return {
    border: 'border-rose-500 dark:border-rose-500 ring-2 ring-rose-400/40 dark:ring-rose-500/30',
    timerBadge: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-bold animate-pulse',
    headerBg: 'bg-rose-500/10 dark:bg-rose-950/30',
    isOverdue: true,
  };
}

function getOrderTypeIcon(orderType: string) {
  switch (orderType) {
    case 'dine_in':
      return <UtensilsCrossed size={13} />;
    case 'takeaway':
      return <ShoppingBag size={13} />;
    case 'delivery':
      return <Truck size={13} />;
    default:
      return null;
  }
}

const STATION_I18N: Record<string, string> = {
  main_kitchen: 'kitchen.stationMainKitchen',
  tandoor: 'kitchen.stationTandoor',
  bar: 'kitchen.stationBar',
  dessert: 'kitchen.stationDessert',
};

const KOTCard: React.FC<KOTCardProps> = ({ kot, onUpdateStatus }) => {
  const { t } = useTranslation();
  const now = useSharedTicker();
  const elapsedSec = useMemo(() => getElapsedSeconds(kot.createdAt), [kot.createdAt, now]);
  const [checkedItemIds, setCheckedItemIds] = useState<Set<number>>(new Set());
  const [reprinting, setReprinting] = useState(false);

  const toggleItemCheck = (itemId: number) => {
    setCheckedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const formatLiveElapsed = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins < 60) {
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  };

  const statusStyle = useMemo(() => {
    switch (kot.status) {
      case KOTStatus.PENDING:
      case KOTStatus.SENT:
        return { badge: 'bg-blue-600 text-white shadow-2xs', label: t('kitchen.kotStatusNew', 'New') };
      case KOTStatus.PREPARING:
        return { badge: 'bg-amber-500 text-white shadow-2xs', label: t('kitchen.kotStatusPreparing', 'Preparing') };
      case KOTStatus.READY:
        return { badge: 'bg-emerald-600 text-white shadow-2xs', label: t('kitchen.kotStatusReady', 'Ready') };
      case KOTStatus.SERVED:
        return { badge: 'bg-gray-500 text-white', label: t('kitchen.served', 'Served') };
      default:
        return { badge: 'bg-gray-500 text-white', label: t('common.unknown', 'Unknown') };
    }
  }, [kot.status, t]);

  const stationLabel = useMemo(() => {
    const s = kot.station;
    if (!s) return '';
    const key = STATION_I18N[s];
    return key ? t(key) : s.replace(/_/g, ' ');
  }, [kot.station, t]);

  const urgency = getUrgencyColor(elapsedSec);
  const isNew = kot.status === KOTStatus.PENDING || kot.status === KOTStatus.SENT;

  const prepDurationText = useMemo(() => {
    if (!kot.readyAt || !kot.createdAt) return null;
    const ready = kot.readyAt.endsWith('Z') ? kot.readyAt : kot.readyAt.replace(' ', 'T') + 'Z';
    const created = kot.createdAt.endsWith('Z') ? kot.createdAt : kot.createdAt.replace(' ', 'T') + 'Z';
    const mins = Math.floor((new Date(ready).getTime() - new Date(created).getTime()) / 60000);
    if (isNaN(mins) || mins < 0) return null;
    return mins < 1 ? '<1m' : `${mins}m`;
  }, [kot.readyAt, kot.createdAt]);

  const handleReprint = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setReprinting(true);
    try {
      if (window.electronAPI?.kot?.printReceipt) {
        await ipc(window.electronAPI.kot.printReceipt(kot.id));
        toast.success(t('kitchen.ticketReprinted', 'KOT reprinted successfully'));
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reprint KOT');
    } finally {
      setReprinting(false);
    }
  };

  const handleAccept = () => onUpdateStatus(kot.id, KOTStatus.PREPARING);
  const handleReady = () => onUpdateStatus(kot.id, KOTStatus.READY);
  const handleServed = () => onUpdateStatus(kot.id, KOTStatus.SERVED);

  return (
    <div
      className={`
        rounded-2xl border-2 ${urgency.border} bg-white dark:bg-slate-900 overflow-hidden
        transition-all duration-200 shadow-xs hover:shadow-md flex flex-col justify-between
        ${isNew ? 'shadow-lg shadow-blue-500/15' : ''}
      `}
    >
      <div>
        {/* Top Header */}
        <div className={`flex items-center justify-between px-3.5 py-2.5 ${urgency.headerBg} border-b border-gray-100 dark:border-slate-800`}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center gap-1 font-bold text-base text-gray-900 dark:text-white font-mono tracking-tight">
              <Hash size={14} className="text-gray-400 dark:text-slate-500" />
              {kot.kotNumber}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusStyle.badge}`}>
              {statusStyle.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {prepDurationText && (
              <span className="text-[11px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-md font-medium">
                {t('kitchen.kotPrepPrefix', { time: prepDurationText })}
              </span>
            )}
            <div className={`flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded-full border ${urgency.timerBadge}`}>
              {urgency.isOverdue ? <AlertTriangle size={12} className="animate-bounce" /> : <Clock size={12} />}
              <span>{formatLiveElapsed(elapsedSec)}</span>
            </div>
            <button
              onClick={handleReprint}
              disabled={reprinting}
              className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors rounded-md hover:bg-black/5 dark:hover:bg-white/5"
              title={t('kitchen.reprintKot', 'Reprint Ticket')}
            >
              {reprinting ? <Loader2 size={13} className="animate-spin text-blue-600" /> : <Printer size={13} />}
            </button>
          </div>
        </div>

        {/* Order Meta Bar */}
        <div className="flex items-center justify-between gap-2 px-3.5 py-1.5 bg-gray-50/50 dark:bg-slate-800/40 border-b border-gray-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2 truncate">
            <span className="flex items-center gap-1 text-gray-600 dark:text-slate-400 font-medium">
              {getOrderTypeIcon(kot.orderType)}
              <span className="font-mono text-gray-800 dark:text-slate-200 font-semibold">#{kot.orderNumber}</span>
            </span>
            {kot.tableName && (
              <span className="font-bold text-gray-900 dark:text-white px-1.5 py-0.2 bg-gray-200/70 dark:bg-slate-700 rounded text-[11px]">
                {kot.tableName}
              </span>
            )}
          </div>
          {stationLabel && (
            <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider shrink-0">
              {stationLabel}
            </span>
          )}
        </div>

        {/* Line Items Checklist */}
        <div className="p-3.5 space-y-2">
          {kot.items.map((item) => {
            const isChecked = checkedItemIds.has(item.id);
            return (
              <div
                key={item.id}
                onClick={() => !item.isCancelled && toggleItemCheck(item.id)}
                className={`
                  flex items-start gap-2.5 p-1 rounded-lg cursor-pointer transition-all select-none
                  ${item.isCancelled ? 'opacity-40 line-through' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}
                  ${item.isNew ? 'bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50' : ''}
                `}
                title={isChecked ? 'Mark item uncompleted' : 'Click to mark item completed'}
              >
                {/* Quantity Box with Checked State */}
                <span
                  className={`
                    shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition-colors
                    ${
                      isChecked
                        ? 'bg-emerald-500 text-white shadow-2xs'
                        : item.isCancelled
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                          : 'bg-gray-100 text-gray-900 dark:bg-slate-800 dark:text-white border border-gray-200/80 dark:border-slate-700'
                    }
                  `}
                >
                  {isChecked ? <Check size={14} strokeWidth={3} /> : item.quantity}
                </span>

                <div className="flex-1 min-w-0 pt-0.5">
                  <span
                    className={`text-xs font-semibold block truncate leading-tight transition-all ${
                      isChecked
                        ? 'line-through text-gray-400 dark:text-slate-500'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {item.name}
                  </span>
                  {item.addons && item.addons.length > 0 && (
                    <span className="text-teal-700 dark:text-teal-400 text-[11px] block mt-0.5 font-medium">
                      + {item.addons.join(', ')}
                    </span>
                  )}
                  {item.notes && (
                    <span className="text-amber-800 dark:text-amber-300 text-[11px] block mt-0.5 font-semibold bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/60">
                      * {item.notes}
                    </span>
                  )}
                </div>

                {item.isNew && (
                  <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold shrink-0">
                    {t('kitchen.itemTagNew', 'NEW')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Touchscreen Bump Button */}
      <div className="p-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/60">
        {(kot.status === KOTStatus.PENDING || kot.status === KOTStatus.SENT) && (
          <button
            type="button"
            onClick={handleAccept}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
              bg-orange-500 hover:bg-orange-600 active:bg-orange-700
              text-white font-bold text-sm transition-all tap-target shadow-xs"
          >
            <PlayCircle size={18} />
            <span>{t('kitchen.kotAccept', 'Start Preparing')}</span>
          </button>
        )}
        {kot.status === KOTStatus.PREPARING && (
          <button
            type="button"
            onClick={handleReady}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
              bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800
              text-white font-bold text-sm transition-all tap-target shadow-xs"
          >
            <CheckCircle2 size={18} />
            <span>{t('kitchen.kotReadyButton', 'Mark Ready')}</span>
          </button>
        )}
        {kot.status === KOTStatus.READY && (
          <button
            type="button"
            onClick={handleServed}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
              bg-blue-600 hover:bg-blue-700 active:bg-blue-800
              text-white font-bold text-sm transition-all tap-target shadow-xs"
          >
            <CheckCircle2 size={18} />
            <span>{t('kitchen.kotServedButton', 'Mark Served')}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default KOTCard;
