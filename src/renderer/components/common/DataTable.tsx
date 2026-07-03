import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Column<T> {
  header: string;
  accessor: keyof T | string;
  render?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T, index: number) => void;
  emptyMessage?: string;
  keyExtractor?: (item: T, index: number) => string | number;
  className?: string;
}

type SortDirection = 'asc' | 'desc' | null;

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

function DataTable<T extends Record<string, any>>({
  columns,
  data,
  onRowClick,
  emptyMessage,
  keyExtractor,
  className = '',
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const resolvedEmptyMessage = emptyMessage ?? t('common.noData');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (accessor: string) => {
    if (sortColumn === accessor) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(accessor);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aVal = getNestedValue(a, sortColumn);
      const bVal = getNestedValue(b, sortColumn);

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else {
        comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }

      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [data, sortColumn, sortDirection]);

  const getSortIcon = (accessor: string) => {
    if (sortColumn !== accessor) {
      return <ChevronsUpDown size={14} className="text-gray-400" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp size={14} className="text-blue-600" />
    ) : (
      <ChevronDown size={14} className="text-blue-600" />
    );
  };

  const alignClass = (align?: string) => {
    switch (align) {
      case 'center':
        return 'text-center';
      case 'right':
        return 'text-right';
      default:
        return 'text-left';
    }
  };

  return (
    <div className={`overflow-x-auto rounded-lg border border-gray-200 ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {columns.map((col) => {
              const accessor = String(col.accessor);
              return (
                <th
                  key={accessor}
                  className={`px-4 py-3 font-semibold text-gray-600 ${alignClass(
                    col.align
                  )} ${col.sortable !== false ? 'cursor-pointer select-none hover:bg-gray-100' : ''}`}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable !== false && handleSort(accessor)}
                >
                  <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                    {col.header}
                    {col.sortable !== false && getSortIcon(accessor)}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center">
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <Inbox size={32} />
                  <span className="text-sm">{resolvedEmptyMessage}</span>
                </div>
              </td>
            </tr>
          ) : (
            sortedData.map((item, index) => (
              <tr
                key={keyExtractor ? keyExtractor(item, index) : index}
                onClick={() => onRowClick?.(item, index)}
                className={`border-b border-gray-100 last:border-b-0 transition-colors ${
                  index % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'
                } ${onRowClick ? 'cursor-pointer hover:bg-blue-50' : ''}`}
              >
                {columns.map((col) => {
                  const accessor = String(col.accessor);
                  return (
                    <td
                      key={accessor}
                      className={`px-4 py-3 ${alignClass(col.align)}`}
                    >
                      {col.render
                        ? col.render(item, index)
                        : getNestedValue(item, accessor) ?? '-'}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
