import React from 'react';
import { Armchair } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TableStatus } from '../../../shared/enums';
import type { Table } from '../../../shared/types/table.types';
import TableCard from './TableCard';

interface TableOrderInfo {
  grandTotal: number;
  itemCount: number;
  createdAt: string;
}

interface TableLayoutProps {
  tables: Table[];
  onTableClick: (table: Table) => void;
  onTableContextMenu?: (e: React.MouseEvent, table: Table) => void;
  isEditMode?: boolean;
  onTableDragEnd?: (tableId: number, posX: number, posY: number) => void;
  /** Map of tableId → order summary for occupied tables */
  tableOrders?: Map<number, TableOrderInfo>;
}

const TableLayout: React.FC<TableLayoutProps> = ({
  tables,
  onTableClick,
  onTableContextMenu,
  isEditMode = false,
  onTableDragEnd,
  tableOrders,
}) => {
  const { t } = useTranslation();
  const dineInCount = tables.filter((t) => t.status === TableStatus.OCCUPIED).length;
  const availableCount = tables.filter((t) => t.status === TableStatus.FREE).length;

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
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <div className="flex items-center gap-6 px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-gray-600">{t('tables.statsDineIn')}</span>
          <span className="font-semibold text-gray-900">{dineInCount}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-gray-600">{t('tables.statsAvailable')}</span>
          <span className="font-semibold text-gray-900">{availableCount}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Armchair size={14} />
          <span>{t('tables.statsTotal', { count: tables.length })}</span>
        </div>

        {/* Legend */}
        <div className="ml-auto flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-400" /> {t('tables.statusFree')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> {t('tables.statusOccupied')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-yellow-400" /> {t('tables.statusReserved')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-gray-400" /> {t('tables.statusDirty')}
          </span>
        </div>
      </div>

      {/* Floor plan */}
      <div
        className="flex-1 bg-gray-50 overflow-auto p-6"
        onDragOver={isEditMode ? handleDragOver : undefined}
        onDrop={isEditMode ? handleDrop : undefined}
      >
        {tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
            <Armchair size={48} />
            <p className="text-sm">{t('tables.noTablesOnFloor')}</p>
          </div>
        ) : isEditMode ? (
          /* Edit mode: absolute positioning for drag & drop */
          <div className="relative w-full" style={{ minHeight: '500px' }}>
            {tables.map((table) => (
              <div
                key={table.id}
                draggable
                onDragStart={(e) => handleDragStart(e, table.id)}
                className="absolute cursor-move transition-all duration-200"
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
                  orderTotal={tableOrders?.get(table.id)?.grandTotal}
                  orderItemCount={tableOrders?.get(table.id)?.itemCount}
                  orderStartedAt={tableOrders?.get(table.id)?.createdAt}
                />
              </div>
            ))}
          </div>
        ) : (
          /* Normal mode: grid layout */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {tables.map((table) => {
              const orderInfo = tableOrders?.get(table.id);
              return (
                <TableCard
                  key={table.id}
                  table={table}
                  onClick={onTableClick}
                  onContextMenu={onTableContextMenu}
                  isEditMode={false}
                  orderTotal={orderInfo?.grandTotal}
                  orderItemCount={orderInfo?.itemCount}
                  orderStartedAt={orderInfo?.createdAt}
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
