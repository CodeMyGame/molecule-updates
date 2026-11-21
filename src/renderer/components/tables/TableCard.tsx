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
    bg: 'bg-emerald-50/80 dark:bg-emerald-950/30 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40',
    border: 'border-emerald-300 dark:border-emerald-800/60',
    badge: 'bg-emerald-600 text-white',
    labelKey: 'tables.statusFree',
  },
  [TableStatus.OCCUPIED]: {
    bg: 'bg-rose-50/80 dark:bg-rose-950/30 hover:bg-rose-100/70 dark:hover:bg-rose-900/40',
    border: 'border-rose-300 dark:border-rose-800/60',
    badge: 'bg-rose-600 text-white',
    labelKey: 'tables.statusOccupied',
  },
  [TableStatus.RESERVED]: {
    bg: 'bg-amber-50/80 dark:bg-amber-950/30 hover:bg-amber-100/70 dark:hover:bg-amber-900/40',
    border: 'border-amber-300 dark:border-amber-800/60',
    badge: 'bg-amber-600 text-white',
    labelKey: 'tables.statusReserved',
  },
  [TableStatus.DIRTY]: {
    bg: 'bg-slate-100/80 dark:bg-slate-800/60 hover:bg-slate-200/60 dark:hover:bg-slate-700/60',
    border: 'border-slate-300 dark:border-slate-700',
    badge: 'bg-slate-600 text-white',
    labelKey: 'tables.statusDirty',
  },
};

function getElapsedMinutes(startedAt: string): number {
  const ts = startedAt.endsWith('Z') ? startedAt : startedAt + 'Z';
  return Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
}

function getWaitTimeColor(minutes: number): { text: string; bg: string } {
  if (minutes < 30) return { text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' };
  if (minutes < 60) return { text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' };
  return { text: 'text-rose-700 dark:text-rose-400 font-bold', bg: 'bg-rose-50 dark:bg-rose-950/40' };
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
  const waitColor = isHold ? { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' } : getWaitTimeColor(elapsedMins);
  // Flag tables sitting for 2+ hours so the admin notices them at a glance (unless on hold)
  const isLongHour = isOccupied && !isHold && elapsedMins >= LONG_HOUR_MINUTES;

  const badgeBg = isHold ? 'bg-amber-500 text-white' : config.badge;
  const badgeText = isHold ? t('reports.statusHold', 'Hold').toUpperCase() : config.label;
  const badgeLetter = isHold ? 'H' : (config.label.length > 0 ? Array.from(config.label)[0]!.toUpperCase() : '?');

  const cardBorderAndBg = isHold
    ? 'border-amber-400 dark:border-amber-600 bg-amber-50/90 dark:bg-amber-950/40 hover:bg-amber-100/70'
    : isOccupied && elapsedMins >= 60
      ? 'border-rose-500 dark:border-rose-500 bg-rose-100/80 dark:bg-rose-950/60'
      : isOccupied && elapsedMins >= 30
        ? 'border-amber-400 dark:border-amber-600 bg-amber-50/90 dark:bg-amber-950/40'
        : `${config.border} ${config.bg}`;

  const isRound = table.shape === 'round' || table.shape === 'circle';

  return (
    <button
      type="button"
      data-selected={isSelected ? 'true' : 'false'}
      onClick={() => onClick(table)}
      onContextMenu={onContextMenu ? (e) => { e.preventDefault(); onContextMenu(e, table); } : undefined}
      className={`
        table-card relative flex flex-col items-center justify-center
        ${isRound ? 'rounded-2xl' : 'rounded-xl'} w-full border
        ${compact ? 'min-h-[68px] p-1.5' : 'min-h-[74px] p-2'}
        ${
          isSelected
            ? 'is-selected table-selected !border-blue-500 dark:!border-sky-400 bg-blue-50/95 dark:bg-blue-950/85 ring-2 ring-blue-500 dark:ring-sky-400 shadow-md dark:shadow-[0_0_16px_rgba(56,189,248,0.45)] z-10 scale-[1.02]'
            : `${cardBorderAndBg} shadow-xs hover:shadow-sm`
        }
        transition-all duration-150
        active:scale-95
        cursor-pointer select-none
        ${isEditMode ? 'ring-2 ring-dashed ring-blue-400 bg-blue-50/40' : ''}
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

      {/* Table Capacity & Pin indicators */}
      <div className="absolute top-1 left-1.5 flex items-center gap-1 z-10 pointer-events-none">
        {table.isPinned && !isSelected && (
          <span
            className="bg-blue-500 text-white rounded-full p-0.5 shadow-xs"
            title={t('common.pinned', 'Pinned')}
          >
            <Pin size={compact ? 7 : 8} className="fill-current" />
          </span>
        )}
        {table.capacity > 0 && !compact && (
          <span className="text-[9px] font-semibold text-gray-400 dark:text-gray-500">
            {table.capacity}p
          </span>
        )}
      </div>

      {/* Table Name */}
      <span
        className={`font-bold px-1 truncate max-w-full text-center transition-colors ${
          compact ? 'text-[11px] mb-0' : 'text-xs mb-0.5'
        } ${
          isSelected
            ? 'text-blue-900 dark:text-sky-100 font-extrabold tracking-wide'
            : 'text-gray-900 dark:text-gray-100'
        }`}
      >
        {table.name}
      </span>

      {/* If Free: subtle status note */}
      {!isOccupied && !compact && (
        <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-medium">
          {t('tables.statusFree', 'Free')}
        </span>
      )}

      {hasOrderInfo && (
        <div className={`flex flex-col items-center w-full ${compact ? 'mt-0.5 gap-0' : 'mt-0.5 gap-0.5'}`}>
          <span
            className={`font-bold font-mono ${
              isHold
                ? 'text-amber-800 dark:text-amber-300'
                : isSelected
                  ? 'text-blue-950 dark:text-amber-300 font-extrabold'
                  : 'text-rose-700 dark:text-rose-400'
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
