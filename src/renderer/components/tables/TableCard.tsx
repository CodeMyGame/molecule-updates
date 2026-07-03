import React, { useMemo } from 'react';
import { Users, Clock, Pin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { currencySymbolForLanguage } from '../../lib/currencyLocale';
import { TableStatus } from '../../../shared/enums';
import type { Table } from '../../../shared/types/table.types';

interface TableCardProps {
  table: Table;
  onClick: (table: Table) => void;
  onContextMenu?: (e: React.MouseEvent, table: Table) => void;
  isEditMode?: boolean;
  orderStartedAt?: string;
  serverName?: string;
  orderTotal?: number;
  orderItemCount?: number;
  compact?: boolean;
}

const STATUS_STYLES: Record<
  TableStatus,
  { bg: string; border: string; badge: string; labelKey: string }
> = {
  [TableStatus.FREE]: {
    bg: 'bg-green-50',
    border: 'border-green-400',
    badge: 'bg-green-500 text-white',
    labelKey: 'tables.statusFree',
  },
  [TableStatus.OCCUPIED]: {
    bg: 'bg-red-50',
    border: 'border-red-400',
    badge: 'bg-red-500 text-white',
    labelKey: 'tables.statusOccupied',
  },
  [TableStatus.RESERVED]: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-400',
    badge: 'bg-yellow-500 text-white',
    labelKey: 'tables.statusReserved',
  },
  [TableStatus.DIRTY]: {
    bg: 'bg-gray-100',
    border: 'border-gray-400',
    badge: 'bg-gray-500 text-white',
    labelKey: 'tables.statusDirty',
  },
};

function getElapsedMinutes(startedAt: string): number {
  const ts = startedAt.endsWith('Z') ? startedAt : startedAt + 'Z';
  return Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
}

function getWaitTimeColor(minutes: number): { text: string; bg: string } {
  if (minutes < 30) return { text: 'text-green-600', bg: '' };
  if (minutes < 60) return { text: 'text-yellow-600', bg: '' };
  return { text: 'text-red-600', bg: 'bg-red-50' };
}

// Tables occupied this long (minutes) get a pulsing alert animation.
const LONG_HOUR_MINUTES = 120;

const TableCard: React.FC<TableCardProps> = ({
  table,
  onClick,
  onContextMenu,
  isEditMode = false,
  orderStartedAt,
  serverName: _serverName,
  orderTotal,
  orderItemCount: _orderItemCount,
  compact = false,
}) => {
  const { t, i18n } = useTranslation();

  const formatPaise = (paise: number) =>
    `${currencySymbolForLanguage(i18n.language)}${(paise / 100).toFixed(0)}`;

  const formatElapsedTime = (minutes: number) => {
    if (minutes < 60) return t('tables.elapsedMinutesCompact', { count: minutes });
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return t('tables.elapsedHoursMinutesCompact', { hours, minutes: remainingMinutes });
  };

  const base = STATUS_STYLES[table.status];
  const config = useMemo(
    () => ({
      ...base,
      label: t(base.labelKey),
    }),
    [base, t]
  );

  const isOccupied = table.status === TableStatus.OCCUPIED;
  const hasOrderInfo = isOccupied && orderTotal !== undefined;
  const elapsedMins = orderStartedAt ? getElapsedMinutes(orderStartedAt) : 0;
  const waitColor = getWaitTimeColor(elapsedMins);
  // Flag tables sitting for 2+ hours so the admin notices them at a glance.
  const isLongHour = isOccupied && elapsedMins >= LONG_HOUR_MINUTES;

  const badgeLetter = config.label.length > 0
    ? Array.from(config.label)[0]!.toUpperCase()
    : '?';

  return (
    <button
      type="button"
      onClick={() => onClick(table)}
      onContextMenu={onContextMenu ? (e) => { e.preventDefault(); onContextMenu(e, table); } : undefined}
      className={`
        relative flex flex-col items-center justify-center
        rounded-lg w-full border-2
        ${compact ? 'h-[68px] p-1.5' : 'min-h-[100px] p-2.5'}
        ${isOccupied && elapsedMins >= 60 ? 'border-red-500 bg-red-50' : isOccupied && elapsedMins >= 30 ? 'border-yellow-500 bg-yellow-50' : `${config.border} ${config.bg}`}
        shadow-sm hover:shadow-md
        transition-all duration-150
        active:scale-95
        cursor-pointer select-none
        ${isEditMode ? 'ring-2 ring-dashed ring-blue-300' : ''}
        ${isLongHour ? 'animate-long-hour' : ''}
        tap-target
      `}
      title={isLongHour ? t('tables.longHourAlert', { defaultValue: 'Occupied over 2 hours' }) : undefined}
    >
      <span
        className={`absolute -top-1.5 -right-1.5 font-bold rounded-full ${config.badge} ${compact ? 'text-[8px] px-1 py-0' : 'text-[10px] px-2 py-0.5'}`}
      >
        {compact ? badgeLetter : config.label}
      </span>

      {table.isPinned && (
        <span className={`absolute ${compact ? '-top-1 -left-1' : '-top-1.5 -left-1.5'} bg-blue-500 text-white rounded-full p-0.5 shadow-sm`} title={t('common.pinned')}>
          <Pin size={compact ? 8 : 11} className="fill-current" />
        </span>
      )}

      <span className={`font-semibold text-gray-800 ${compact ? 'text-[11px] mb-0' : 'text-sm mb-1'}`}>{table.name}</span>

      <span className={`flex items-center gap-0.5 text-gray-500 ${compact ? 'text-[9px]' : 'text-xs'}`}>
        <Users size={compact ? 8 : 12} />
        <span>{table.capacity}</span>
      </span>

      {hasOrderInfo && (
        <div className={`flex flex-col items-center w-full ${compact ? 'mt-0.5 gap-0' : 'mt-2 gap-1'}`}>
          <span className={`font-bold text-red-700 ${compact ? 'text-[9px]' : 'text-sm'}`}>
            {formatPaise(orderTotal!)}
          </span>
          {orderStartedAt && (
            <span className={`flex items-center gap-0.5 font-medium ${waitColor.text} ${isLongHour ? 'animate-pulse font-bold' : ''} ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
              <Clock size={compact ? 7 : 10} />
              {formatElapsedTime(elapsedMins)}
            </span>
          )}
        </div>
      )}

      {isOccupied && !hasOrderInfo && orderStartedAt && (
        <span className={`flex items-center gap-0.5 font-medium mt-0.5 ${waitColor.text} ${isLongHour ? 'animate-pulse font-bold' : ''} ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
          <Clock size={compact ? 7 : 10} />
          {formatElapsedTime(elapsedMins)}
        </span>
      )}
    </button>
  );
};

export default TableCard;
