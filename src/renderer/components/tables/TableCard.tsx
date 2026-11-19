import React, { useMemo } from 'react';
import { Clock, Pin, Pause, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { currencySymbolForLanguage } from '../../lib/currencyLocale';
import { TableStatus } from '../../../shared/enums';
import type { Table } from '../../../shared/types/table.types';

interface TableCardProps {
  table: Table;
  onClick: (table: Table) => void;
  onContextMenu?: (e: React.MouseEvent, table: Table) => void;
  isEditMode?: boolean;
  isSelected?: boolean;
  orderStartedAt?: string;
  serverName?: string;
  orderTotal?: number;
  orderItemCount?: number;
  compact?: boolean;
  orderStatus?: string;
  kotBadge?: { label: string; bg: string; dot: string };
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
  isSelected = false,
  orderStartedAt,
  serverName: _serverName,
  orderTotal,
  orderItemCount: _orderItemCount,
  compact = false,
  orderStatus,
  kotBadge,
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
  const isHold = isOccupied && orderStatus === 'hold';
  const hasOrderInfo = isOccupied && orderTotal !== undefined;
  const elapsedMins = orderStartedAt ? getElapsedMinutes(orderStartedAt) : 0;
  const waitColor = isHold ? { text: 'text-amber-600', bg: 'bg-amber-50' } : getWaitTimeColor(elapsedMins);
  // Flag tables sitting for 2+ hours so the admin notices them at a glance (unless on hold)
  const isLongHour = isOccupied && !isHold && elapsedMins >= LONG_HOUR_MINUTES;

  const badgeBg = isHold ? 'bg-amber-500 text-white' : config.badge;
  const badgeText = isHold ? t('reports.statusHold', 'Hold').toUpperCase() : config.label;
  const badgeLetter = isHold ? 'H' : (config.label.length > 0 ? Array.from(config.label)[0]!.toUpperCase() : '?');

  const cardBorderAndBg = isHold
    ? 'border-amber-400 bg-amber-50 hover:bg-amber-100/70 hover:border-amber-500'
    : isOccupied && elapsedMins >= 60
      ? 'border-red-500 bg-red-50'
      : isOccupied && elapsedMins >= 30
        ? 'border-yellow-500 bg-yellow-50'
        : `${config.border} ${config.bg}`;

  return (
    <button
      type="button"
      data-selected={isSelected ? 'true' : 'false'}
      onClick={() => onClick(table)}
      onContextMenu={onContextMenu ? (e) => { e.preventDefault(); onContextMenu(e, table); } : undefined}
      className={`
        table-card relative flex flex-col items-center justify-center
        rounded-lg w-full border
        ${compact ? 'min-h-[68px] p-1.5' : 'min-h-[72px] p-1.5'}
        ${
          isSelected
            ? 'is-selected table-selected !border-blue-500 dark:!border-sky-400 bg-blue-50/95 dark:bg-blue-950/85 ring-2 ring-blue-500 dark:ring-sky-400 shadow-md dark:shadow-[0_0_16px_rgba(56,189,248,0.45)] z-10 scale-[1.02]'
            : `${cardBorderAndBg} shadow-xs hover:shadow-sm`
        }
        transition-all duration-150
        active:scale-95
        cursor-pointer select-none
        ${isEditMode ? 'ring-2 ring-dashed ring-blue-300' : ''}
        ${isLongHour && !isSelected ? 'animate-long-hour' : ''}
        tap-target
      `}
      title={isHold ? t('reports.statusHold', 'Hold') : isLongHour ? t('tables.longHourAlert', { defaultValue: 'Occupied over 2 hours' }) : undefined}
    >
      {/* Corner Status Badge */}
      <span
        className={`absolute -top-1 -right-1 font-bold rounded-full flex items-center justify-center gap-0.5 ${badgeBg} ${
          compact ? 'text-[8px] px-1 py-0' : 'text-[9px] px-1.5 py-0.2'
        } ${isSelected ? 'ring-2 ring-white dark:ring-sky-400 shadow-xs' : ''}`}
      >
        {isHold && <Pause size={compact ? 6 : 7} className="fill-current shrink-0" />}
        {compact ? badgeLetter : badgeText}
      </span>

      {/* Selected Indicator Badge */}
      {isSelected && (
        <span
          className="absolute -top-1.5 -left-1.5 bg-blue-600 dark:bg-sky-500 text-white rounded-full p-0.5 shadow-md ring-2 ring-white dark:ring-gray-900 z-20 flex items-center justify-center animate-in zoom-in-75 duration-100"
          title="Selected"
        >
          <Check size={compact ? 8 : 10} strokeWidth={3.5} />
        </span>
      )}

      {/* Pinned Icon */}
      {table.isPinned && (
        <span
          className={`absolute ${isSelected ? (compact ? 'top-3.5 -left-1' : 'top-4 -left-1') : '-top-1 -left-1'} bg-blue-500 text-white rounded-full p-0.5 shadow-xs`}
          title={t('common.pinned')}
        >
          <Pin size={compact ? 7 : 9} className="fill-current" />
        </span>
      )}

      {/* Table Name */}
      <span
        className={`font-bold px-1 truncate max-w-full text-center transition-colors ${
          compact ? 'text-[11px] mb-0' : 'text-xs mb-0.5'
        } ${
          isSelected
            ? 'text-blue-900 dark:text-sky-100 font-extrabold tracking-wide'
            : 'text-gray-800 dark:text-gray-100'
        }`}
      >
        {table.name}
      </span>

      {hasOrderInfo && (
        <div className={`flex flex-col items-center w-full ${compact ? 'mt-0.5 gap-0' : 'mt-1 gap-0.5'}`}>
          <span
            className={`font-bold ${
              isHold
                ? 'text-amber-800 dark:text-amber-300'
                : isSelected
                  ? 'text-blue-950 dark:text-amber-300 font-extrabold'
                  : 'text-red-700 dark:text-red-400'
            } ${compact ? 'text-[10px]' : 'text-xs'}`}
          >
            {formatPaise(orderTotal!)}
          </span>
          {orderStartedAt && (
            <span
              className={`flex items-center gap-0.5 font-medium ${
                isSelected ? 'text-blue-800 dark:text-sky-300 font-semibold' : waitColor.text
              } ${isLongHour ? 'animate-pulse font-bold' : ''} ${
                compact ? 'text-[9px]' : 'text-[9px]'
              }`}
            >
              <Clock size={compact ? 8 : 9} />
              {formatElapsedTime(elapsedMins)}
            </span>
          )}
        </div>
      )}

      {isOccupied && !hasOrderInfo && orderStartedAt && (
        <span
          className={`flex items-center gap-0.5 font-medium mt-0.5 ${
            isSelected ? 'text-blue-800 dark:text-sky-300 font-semibold' : waitColor.text
          } ${isLongHour ? 'animate-pulse font-bold' : ''} ${
            compact ? 'text-[9px]' : 'text-[9px]'
          }`}
        >
          <Clock size={compact ? 8 : 9} />
          {formatElapsedTime(elapsedMins)}
        </span>
      )}

      {isOccupied && kotBadge && (
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full border mt-1 leading-tight font-medium ${kotBadge.bg} ${
            compact ? 'text-[8px]' : 'text-[9px]'
          } ${isSelected ? 'ring-1 ring-blue-400/50 dark:ring-sky-400/60' : ''}`}
        >
          <span className={`rounded-full shrink-0 ${kotBadge.dot} ${compact ? 'w-1 h-1' : 'w-1.5 h-1.5'}`} />
          <span className="truncate max-w-[80px]">{kotBadge.label}</span>
        </span>
      )}
    </button>
  );
};

export default TableCard;
