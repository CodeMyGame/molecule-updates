import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Inbox, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';

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
  enableInfiniteScroll?: boolean;
  pageSize?: number;
  initialPageSize?: number;
  loading?: boolean;
  shimmerRows?: number;
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
  enableInfiniteScroll = true,
  pageSize = 40,
  initialPageSize,
  loading = false,
  shimmerRows = 6,
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

  const isInfiniteScrollActive = enableInfiniteScroll !== false && sortedData.length > pageSize;

  const {
    visibleItems,
    hasMore,
    loadMore,
    displayCount,
    totalCount,
    observerTarget,
  } = useInfiniteScroll(sortedData, {
    pageSize,
    initialCount: initialPageSize ?? pageSize,
    enabled: isInfiniteScrollActive,
  });

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
          {loading ? (
            Array.from({ length: shimmerRows }).map((_, rIdx) => {
              const widths = ['65%', '85%', '50%', '75%', '40%', '60%'];
              return (
                <tr key={`shimmer-row-${rIdx}`} className="border-b border-gray-100 last:border-b-0">
                  {columns.map((col, cIdx) => {
                    const w = widths[(rIdx + cIdx) % widths.length];
                    return (
                      <td key={`shimmer-cell-${cIdx}`} className={`px-4 py-3.5 ${alignClass(col.align)}`}>
                        <div
                          className={`shimmer h-3.5 rounded ${
                            col.align === 'right' ? 'ml-auto' : col.align === 'center' ? 'mx-auto' : ''
                          }`}
                          style={{ width: col.width && !col.width.includes('%') ? '80%' : w, maxWidth: '100%' }}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })
          ) : sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center">
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <Inbox size={32} />
                  <span className="text-sm">{resolvedEmptyMessage}</span>
                </div>
              </td>
            </tr>
          ) : (
            visibleItems.map((item, index) => (
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
          {isInfiniteScrollActive && hasMore && (
            <tr>
              <td colSpan={columns.length} className="p-0 border-none">
                <div
                  ref={observerTarget}
                  className="py-3 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5"
                >
                  <Loader2 size={13} className="animate-spin text-blue-500" />
                  <span>{t('common.loading')}</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {isInfiniteScrollActive && (
        <div className="px-4 py-2.5 bg-gray-50/90 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between select-none">
          <span>
            {t('common.showingCount', {
              count: displayCount,
              total: totalCount,
              defaultValue: `Showing ${displayCount} of ${totalCount} records`,
            })}
          </span>
          <div className="flex items-center gap-2">
            {hasMore ? (
              <>
                <button
                  type="button"
                  onClick={loadMore}
                  className="text-blue-600 hover:text-blue-700 font-medium hover:underline cursor-pointer"
                >
                  {t('common.loadMore', 'Load more')}
                </button>
                <span className="text-gray-300">•</span>
                <span className="text-gray-400">{t('common.scrollForMore', 'Scroll down for more')}</span>
              </>
            ) : (
              <span className="text-gray-400">{t('common.allLoaded', 'All records loaded')}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
