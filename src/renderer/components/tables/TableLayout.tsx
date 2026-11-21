import React, { useMemo } from 'react';
import { Armchair, Banknote, Move } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TableStatus } from '../../../shared/enums';
import type { Table } from '../../../shared/types/table.types';
import TableCard from './TableCard';
import { compareTableNames, formatCurrency } from '../../lib/formatters';

interface TableOrderInfo {
  grandTotal: number;
  itemCount: number;
  createdAt: string;
  orderStatus?: string;
  orderId?: number;
  kotBadge?: { label: string; bg: string; dot: string };
}

interface TableLayoutProps {
  tables: Table[];
  onTableClick: (table: Table) => void;
  onTableContextMenu?: (e: React.MouseEvent, table: Table) => void;
  isEditMode?: boolean;
  onTableDragEnd?: (tableId: number, posX: number, posY: number) => void;
  /** Map of tableId → order summary for occupied tables */
  tableOrders?: Map<number, TableOrderInfo>;
  selectedTableId?: number | null;
}

const TableLayout: React.FC<TableLayoutProps> = ({
  tables,
  onTableClick,
  onTableContextMenu,
  isEditMode = false,
  onTableDragEnd,
  tableOrders,
  selectedTableId,
}) => {
  const { t } = useTranslation();
  const dineInCount = tables.filter((t) => t.status === TableStatus.OCCUPIED).length;
  const availableCount = tables.filter((t) => t.status === TableStatus.FREE).length;
  const holdCount = tables.filter(
    (t) => t.status === TableStatus.OCCUPIED && tableOrders?.get(t.id)?.orderStatus === 'hold'
  ).length;

  const activeFloorRevenue = useMemo(() => {
    return tables.reduce((sum, t) => {
      const info = tableOrders?.get(t.id);
      return sum + (info?.grandTotal ?? 0);
    }, 0);
  }, [tables, tableOrders]);

  const sortedTables = useMemo(() => [...tables].sort(compareTableNames), [tables]);

  const handleDragStart = (e: React.DragEvent, tableId: number) => {
    if (!isEditMode) return;
    e.dataTransfer.setData('tableId', String(tableId));
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isEditMode) return;
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isEditMode || !onTableDragEnd) return;
    e.preventDefault();

    const tableId = Number(e.dataTransfer.getData('tableId'));
    const container = e.currentTarget.getBoundingClientRect();
    const posX = Math.round(((e.clientX - container.left) / container.width) * 100);
    const posY = Math.round(((e.clientY - container.top) / container.height) * 100);

    onTableDragEnd(tableId, Math.max(0, Math.min(posX, 90)), Math.max(0, Math.min(posY, 90)));
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Stats bar */}
      <div className="flex items-center gap-3.5 px-3.5 py-2 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex-wrap text-xs select-none">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-gray-600 dark:text-gray-400 font-medium">{t('tables.statsDineIn')}</span>
          <span className="font-bold text-gray-900 dark:text-white">{dineInCount}</span>
        </div>
        {holdCount > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-gray-600 dark:text-gray-400 font-medium">{t('reports.statusHold', 'Hold')}</span>
            <span className="font-bold text-amber-700 dark:text-amber-400">{holdCount}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-gray-600 dark:text-gray-400 font-medium">{t('tables.statsAvailable')}</span>
          <span className="font-bold text-gray-900 dark:text-white">{availableCount}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
          <Armchair size={13} className="text-gray-400" />
          <span>{t('tables.statsTotal', { count: tables.length })}</span>
        </div>

        {activeFloorRevenue > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 font-semibold">
            <Banknote size={12} className="text-emerald-600 dark:text-emerald-400" />
            <span>{t('tables.activeChecks', 'Active Checks')}: {formatCurrency(activeFloorRevenue)}</span>
          </div>
        )}

        {/* Legend */}
        <div className="ml-auto flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400 flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-emerald-500" /> {t('tables.statusFree')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-rose-500" /> {t('tables.statusOccupied')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-amber-500" /> {t('reports.statusHold', 'Hold')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-amber-400" /> {t('tables.statusReserved')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-slate-400" /> {t('tables.statusDirty')}
          </span>
        </div>
      </div>

      {/* Edit Mode Banner */}
      {isEditMode && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/50 border-b border-blue-200 dark:border-blue-900/40 flex items-center gap-2 text-xs text-blue-800 dark:text-blue-300">
          <Move size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
          <span>
            {t('tables.arrangeModeHelp', 'Arrange Mode Active: Drag and drop tables to position them on the floor plan canvas. Layout saves automatically.')}
          </span>
        </div>
      )}

      {/* Floor plan */}
      <div
        className={`flex-1 overflow-auto p-4 ${
          isEditMode
            ? 'bg-[radial-gradient(#d1d5db_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] bg-slate-50 dark:bg-slate-900'
            : 'bg-gray-50/60 dark:bg-slate-900/50'
        }`}
        onDragOver={isEditMode ? handleDragOver : undefined}
        onDrop={isEditMode ? handleDrop : undefined}
      >
        {tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 gap-2 py-16">
            <Armchair size={42} className="opacity-40" />
            <p className="text-xs font-medium">{t('tables.noTablesOnFloor')}</p>
          </div>
        ) : isEditMode ? (
          /* Edit mode: absolute positioning for drag & drop */
          <div className="relative w-full h-full min-h-[520px]">
            {tables.map((table) => {
              const orderInfo = tableOrders?.get(table.id);
              return (
                <div
                  key={table.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, table.id)}
                  className="absolute cursor-move transition-all duration-150 active:scale-105 z-10 w-28"
                  style={{
                    left: `${table.posX}%`,
                    top: `${table.posY}%`,
                  }}
                >
                  <TableCard
                    table={table}
                    onClick={onTableClick}
                    onContextMenu={onTableContextMenu}
                    isEditMode={isEditMode}
                    isSelected={selectedTableId === table.id}
                    orderTotal={orderInfo?.grandTotal}
                    orderItemCount={orderInfo?.itemCount}
                    orderStartedAt={orderInfo?.createdAt}
                    orderStatus={orderInfo?.orderStatus}
                    kotBadge={orderInfo?.kotBadge}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          /* Normal mode: responsive grid layout */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
            {sortedTables.map((table) => {
              const orderInfo = tableOrders?.get(table.id);
              return (
                <TableCard
                  key={table.id}
                  table={table}
                  onClick={onTableClick}
                  onContextMenu={onTableContextMenu}
                  isEditMode={false}
                  isSelected={selectedTableId === table.id}
                  orderTotal={orderInfo?.grandTotal}
                  orderItemCount={orderInfo?.itemCount}
                  orderStartedAt={orderInfo?.createdAt}
                  orderStatus={orderInfo?.orderStatus}
                  kotBadge={orderInfo?.kotBadge}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TableLayout;
