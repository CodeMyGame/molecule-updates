import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Clock,
  PlayCircle,
  CheckCircle2,
  Truck,
  UtensilsCrossed,
  ShoppingBag,
  Hash,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { KOTStatus } from '../../../shared/enums';
import type { KOT } from '../../stores/kot.store';

interface KOTCardProps {
  kot: KOT;
  onUpdateStatus: (id: number, status: KOTStatus) => void;
}

function getElapsedMinutes(createdAt: string): number {
  const ts = createdAt.endsWith('Z') ? createdAt : createdAt + 'Z';
  const created = new Date(ts).getTime();
  const now = Date.now();
  return Math.floor((now - created) / 60000);
}

function getUrgencyColor(minutes: number): {
  border: string;
  timer: string;
  bg: string;
} {
  if (minutes < 10) {
    return {
      border: 'border-green-500',
      timer: 'text-green-400',
      bg: 'bg-green-500/10',
    };
  }
  if (minutes < 20) {
    return {
      border: 'border-yellow-500',
      timer: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
    };
  }
  return {
    border: 'border-red-500',
    timer: 'text-red-400',
    bg: 'bg-red-500/10',
  };
}

function getOrderTypeIcon(orderType: string) {
  switch (orderType) {
    case 'dine_in':
      return <UtensilsCrossed size={14} />;
    case 'takeaway':
      return <ShoppingBag size={14} />;
    case 'delivery':
      return <Truck size={14} />;
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
  const [elapsed, setElapsed] = useState(getElapsedMinutes(kot.createdAt));

  const formatElapsed = useCallback(
    (minutes: number) => {
      if (minutes < 1) return t('kitchen.kotElapsedLessThanMin');
      if (minutes < 60) return t('kitchen.kotElapsedMin', { count: minutes });
      const hrs = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return t('kitchen.kotElapsedHourMin', { hours: hrs, mins });
    },
    [t]
  );

  const statusStyle = useMemo(() => {
    switch (kot.status) {
      case KOTStatus.PENDING:
      case KOTStatus.SENT:
        return { badge: 'bg-blue-600 text-white', label: t('kitchen.kotStatusNew') };
      case KOTStatus.PREPARING:
        return { badge: 'bg-orange-500 text-white', label: t('kitchen.kotStatusPreparing') };
      case KOTStatus.READY:
        return { badge: 'bg-green-600 text-white', label: t('kitchen.kotStatusReady') };
      case KOTStatus.SERVED:
        return { badge: 'bg-gray-500 text-white', label: t('kitchen.served') };
      default:
        return { badge: 'bg-gray-500 text-white', label: t('common.unknown') };
    }
  }, [kot.status, t]);

  const stationLabel = useMemo(() => {
    const s = kot.station;
    if (!s) return '';
    const key = STATION_I18N[s];
    return key ? t(key) : s.replace(/_/g, ' ');
  }, [kot.station, t]);

  const urgency = getUrgencyColor(elapsed);
  const isNew =
    kot.status === KOTStatus.PENDING || kot.status === KOTStatus.SENT;

  const prepTime = (() => {
    if (kot.readyAt) {
      const ready = kot.readyAt.endsWith('Z') ? kot.readyAt : kot.readyAt + 'Z';
      const created = kot.createdAt.endsWith('Z') ? kot.createdAt : kot.createdAt + 'Z';
      return Math.floor((new Date(ready).getTime() - new Date(created).getTime()) / 60000);
    }
    return null;
  })();

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(getElapsedMinutes(kot.createdAt));
    }, 30000);
    return () => clearInterval(timer);
  }, [kot.createdAt]);

  const handleAccept = () => {
    onUpdateStatus(kot.id, KOTStatus.PREPARING);
  };

  const handleReady = () => {
    onUpdateStatus(kot.id, KOTStatus.READY);
  };

  const handleServed = () => {
    onUpdateStatus(kot.id, KOTStatus.SERVED);
  };

  return (
    <div
      className={`
        rounded-xl border-2 ${urgency.border} bg-gray-900 overflow-hidden
        transition-all duration-300
        ${isNew ? 'animate-pulse-subtle shadow-lg shadow-blue-500/20' : ''}
      `}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-white font-bold text-lg">
            <Hash size={16} className="text-gray-400" />
            {kot.kotNumber}
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusStyle.badge}`}>
            {statusStyle.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {prepTime !== null && (
            <span className="text-xs bg-green-800 text-green-300 px-1.5 py-0.5 rounded font-medium">
              {t('kitchen.kotPrepPrefix', { time: formatElapsed(prepTime) })}
            </span>
          )}
          <div className={`flex items-center gap-1.5 font-mono font-bold text-sm ${urgency.timer}`}>
            <Clock size={14} />
            {formatElapsed(elapsed)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-700/50 text-sm">
        <span className="flex items-center gap-1 text-gray-400">
          {getOrderTypeIcon(kot.orderType)}
          <span className="text-gray-300">#{kot.orderNumber}</span>
        </span>
        {kot.tableName && (
          <span className="text-gray-300 font-medium">{kot.tableName}</span>
        )}
        {stationLabel && (
          <span className="text-gray-500 text-xs capitalize">{stationLabel}</span>
        )}
      </div>

      <div className="px-4 py-3 space-y-2">
        {kot.items.map((item) => (
          <div
            key={item.id}
            className={`
              flex items-start gap-3
              ${item.isCancelled ? 'opacity-40 line-through' : ''}
              ${item.isNew ? 'bg-blue-500/10 -mx-2 px-2 py-1 rounded' : ''}
            `}
          >
            <span
              className={`
                flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
                font-bold text-sm
                ${item.isCancelled ? 'bg-red-900/50 text-red-400' : 'bg-gray-700 text-white'}
              `}
            >
              {item.quantity}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-white font-medium text-sm block truncate">
                {item.name}
              </span>
              {item.addons && item.addons.length > 0 && (
                <span className="text-cyan-400 text-xs block mt-0.5">
                  + {item.addons.join(', ')}
                </span>
              )}
              {item.notes && (
                <span className="text-yellow-400 text-xs block mt-0.5">
                  * {item.notes}
                </span>
              )}
            </div>
            {item.isNew && (
              <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold flex-shrink-0">
                {t('kitchen.itemTagNew')}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-gray-700/50 flex gap-2">
        {(kot.status === KOTStatus.PENDING || kot.status === KOTStatus.SENT) && (
          <button
            type="button"
            onClick={handleAccept}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg
              bg-orange-500 hover:bg-orange-600 active:bg-orange-700
              text-white font-bold text-sm transition-colors tap-target"
          >
            <PlayCircle size={18} />
            {t('kitchen.kotAccept')}
          </button>
        )}
        {kot.status === KOTStatus.PREPARING && (
          <button
            type="button"
            onClick={handleReady}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg
              bg-green-600 hover:bg-green-700 active:bg-green-800
              text-white font-bold text-sm transition-colors tap-target"
          >
            <CheckCircle2 size={18} />
            {t('kitchen.kotReadyButton')}
          </button>
        )}
        {kot.status === KOTStatus.READY && (
          <button
            type="button"
            onClick={handleServed}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg
              bg-blue-600 hover:bg-blue-700 active:bg-blue-800
              text-white font-bold text-sm transition-colors tap-target"
          >
            <CheckCircle2 size={18} />
            {t('kitchen.kotServedButton')}
          </button>
        )}
      </div>
    </div>
  );
};

export default KOTCard;
