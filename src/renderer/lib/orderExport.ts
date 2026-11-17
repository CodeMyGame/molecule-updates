import { ipc } from './ipc';
import { formatDateTime } from './formatters';
import type { OrderExportRow } from '../../shared/types/order.types';
import toast from 'react-hot-toast';

function escapeCsv(cell: any): string {
  if (cell == null || cell === undefined) return '""';
  const str = String(cell);
  return `"${str.replace(/"/g, '""')}"`;
}

function formatPaiseToRupees(paise: number): string {
  if (paise == null || isNaN(paise)) return '0.00';
  return (paise / 100).toFixed(2);
}

export async function downloadAllOrdersAsExcel(
  t?: (key: string, options?: any) => string
): Promise<{ success: boolean; count: number }> {
  try {
    const orders = await ipc<OrderExportRow[]>(window.electronAPI.orders.exportAll());
    if (!orders || orders.length === 0) {
      toast(
        t
          ? t('activate.noOrdersToExport', { defaultValue: 'No orders found to export.' })
          : 'No orders found to export.'
      );
      return { success: true, count: 0 };
    }

    const headers = [
      'Order #',
      'Date & Time',
      'Completed At',
      'Status',
      'Order Type',
      'Table',
      'Customer Name',
      'Customer Phone',
      'Staff',
      'Total Items',
      'Items Ordered',
      'Subtotal (₹)',
      'Discount (₹)',
      'Discount Reason',
      'Tax (₹)',
      'Round Off (₹)',
      'Coins Redeemed (₹)',
      'Grand Total (₹)',
      'Net Payable (₹)',
      'Payment Details',
      'Notes',
    ];

    const rows = orders.map((o) => [
      escapeCsv(o.orderNumber),
      escapeCsv(o.createdAt ? formatDateTime(o.createdAt) : ''),
      escapeCsv(o.completedAt ? formatDateTime(o.completedAt) : ''),
      escapeCsv(o.status),
      escapeCsv(o.orderType),
      escapeCsv(o.tableName || '-'),
      escapeCsv(o.customerName || '-'),
      escapeCsv(o.customerPhone || '-'),
      escapeCsv(o.staffName || '-'),
      escapeCsv(o.itemCount),
      escapeCsv(o.itemsSummary || '-'),
      escapeCsv(formatPaiseToRupees(o.subtotal)),
      escapeCsv(formatPaiseToRupees(o.discountAmount)),
      escapeCsv(o.discountReason || '-'),
      escapeCsv(formatPaiseToRupees(o.taxAmount)),
      escapeCsv(formatPaiseToRupees(o.roundOff)),
      escapeCsv(formatPaiseToRupees(o.coinsRedeemed)),
      escapeCsv(formatPaiseToRupees(o.grandTotal)),
      escapeCsv(formatPaiseToRupees(o.netAmount)),
      escapeCsv(o.paymentMethods || '-'),
      escapeCsv(o.notes || '-'),
    ]);

    const headerLine = headers.map(escapeCsv).join(',');
    const bodyLines = rows.map((r) => r.join(','));
    // Use CRLF for Excel Windows compatibility and UTF-8 BOM (\uFEFF)
    const csvContent = '\uFEFF' + [headerLine, ...bodyLines].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `Molecule_All_Orders_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(
      t
        ? t('activate.exportOrdersSuccess', { count: orders.length, defaultValue: `Exported ${orders.length} orders successfully!` })
        : `Exported ${orders.length} orders successfully!`
    );

    return { success: true, count: orders.length };
  } catch (err: any) {
    console.error('Failed to export orders:', err);
    toast.error(
      t
        ? t('activate.exportOrdersFailed', { defaultValue: 'Failed to export orders. Please try again.' })
        : 'Failed to export orders. Please try again.'
    );
    return { success: false, count: 0 };
  }
}
