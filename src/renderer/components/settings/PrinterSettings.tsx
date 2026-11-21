import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Printer,
  Receipt,
  ChefHat,
  SlidersHorizontal,
  FileText,
  Layers,
  TestTube,
  GitFork,
  Flame,
  Wine,
  Cake,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  GripVertical,
  RotateCcw,
  QrCode,
  Image as ImageIcon,
  Check,
  Zap,
} from 'lucide-react';
import Button from '../common/Button';
import { ipc } from '../../lib/ipc';
import toast from 'react-hot-toast';
import type { Restaurant } from '../../../shared/types/settings.types';
import {
  mergeLayout,
  defaultLayout,
  BILL_FIELD_DEFS,
  KOT_FIELD_DEFS,
  getFieldDef,
  isReorderable,
  isFieldVisible,
  type ReceiptLayout,
  type ReceiptFieldDef,
} from '../../../shared/receipt-layout';
import {
  renderBillText,
  renderKotText,
  buildSampleBillModel,
  buildSampleKotModel,
  computePrintLineWidth,
  fontScale,
  normalizePrintMode,
  type ReceiptItemStyle,
  generateUpiUrl,
} from '../../../shared/receipt-render';
import { renderQrSvg, QR_STYLES, type QrStyle } from '../../../shared/qr-render';

interface PrinterSettingsProps {
  settings: Record<string, string>;
  handleUpdateSetting: (key: string, value: string) => Promise<void>;
  handleToggleSetting: (key: string) => Promise<void>;
  setSetting: (key: string, value: string) => Promise<void>;
  showSaveConfirmation: () => void;
  restaurant: Restaurant | null;
  taxTerms: any;
}

type PrinterSubTab = 'devices' | 'format' | 'template' | 'fields';

const ReceiptFieldLabelInput: React.FC<{
  value: string;
  placeholder: string;
  onCommit: (label: string) => void;
}> = ({ value, placeholder, onCommit }) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <input
      type="text"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      onDragStart={(e) => e.stopPropagation()}
      draggable={false}
      className="w-28 text-[11px] border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
    />
  );
};

export const PrinterSettings: React.FC<PrinterSettingsProps> = ({
  settings,
  handleUpdateSetting,
  handleToggleSetting,
  setSetting,
  showSaveConfirmation,
  restaurant,
  taxTerms,
}) => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<PrinterSubTab>('devices');
  const [previewKind, setPreviewKind] = useState<'bill' | 'kot'>('bill');
  const [fieldEditorKind, setFieldEditorKind] = useState<'bill' | 'kot'>('bill');

  const [printerList, setPrinterList] = useState<{ name: string; displayName: string; isDefault: boolean }[]>([]);
  const [printersLoading, setPrintersLoading] = useState(false);
  const [testingBill, setTestingBill] = useState(false);
  const [testingKot, setTestingKot] = useState(false);

  const [dragField, setDragField] = useState<{ kind: 'bill' | 'kot'; index: number } | null>(null);
  const [dragOverField, setDragOverField] = useState<{ kind: 'bill' | 'kot'; index: number } | null>(null);

  const loadPrinters = async () => {
    setPrintersLoading(true);
    try {
      const list = await ipc<{ name: string; displayName: string; isDefault: boolean }[]>(
        window.electronAPI.settings.getPrinters()
      );
      setPrinterList(list ?? []);
    } catch {
      setPrinterList([]);
    } finally {
      setPrintersLoading(false);
    }
  };

  useEffect(() => {
    loadPrinters();
  }, []);

  const handleTestBill = async () => {
    setTestingBill(true);
    try {
      await ipc(window.electronAPI.bill.testPrint());
      showSaveConfirmation();
      toast.success(t('settingsPage.testBillSuccess', 'Bill test print triggered'));
    } catch (err: any) {
      toast.error(err?.message || 'Bill test print failed');
    } finally {
      setTestingBill(false);
    }
  };

  const handleTestKot = async () => {
    setTestingKot(true);
    try {
      await ipc(window.electronAPI.kot.testPrint());
      showSaveConfirmation();
      toast.success(t('settingsPage.testKotSuccess', 'KOT test print triggered'));
    } catch (err: any) {
      toast.error(err?.message || 'KOT test print failed');
    } finally {
      setTestingKot(false);
    }
  };

  // Preview data computations
  const paperWidth = settings.paper_width ?? '58mm';
  const printMode = normalizePrintMode(settings.print_mode);
  const billLayout = mergeLayout(settings.bill_layout, BILL_FIELD_DEFS);
  const kotLayout = mergeLayout(settings.kot_layout, KOT_FIELD_DEFS);

  const billW = computePrintLineWidth(paperWidth, printMode, settings.bill_font_size ?? 'small', true);
  const kotW = computePrintLineWidth(paperWidth, printMode, settings.kot_font_size ?? 'small', true);

  const billLabels: Record<string, string> = {
    phone: t('bill.tel', 'Tel:'),
    gstin: taxTerms?.businessTaxId ?? 'GSTIN',
    fssai: taxTerms?.foodLicense ?? 'FSSAI',
    orderNo: t('bill.orderNo', 'Order No'),
    date: t('bill.date', 'Date'),
    type: t('bill.type', 'Type'),
    table: t('bill.table', 'Table'),
    cashier: t('bill.cashier', 'Cashier'),
    item: t('bill.item', 'Item'),
    qty: t('bill.qty', 'Qty'),
    amount: t('bill.amount', 'Amount'),
    subtotal: t('bill.subtotal', 'Subtotal'),
    discount: t('bill.discount', 'Discount'),
    roundOff: t('bill.roundOff', 'Round Off'),
    grandTotal: t('bill.grandTotal', 'Grand Total'),
    coinsRedeemed: t('bill.coinsRedeemed', 'Coins Redeemed'),
    coinsEarned: t('bill.coinsEarned', 'Coins Earned'),
    thankYou: t('bill.thankYou', 'Thank you! Visit again'),
  };

  const kotPreviewLabels: Record<string, string> = {
    title: 'KOT',
    kotCount: 'KOT Count',
    date: 'Date',
    totalItems: 'Total Items',
    item: 'Item',
    qty: 'Qty',
  };

  const billText = renderBillText(
    buildSampleBillModel(billLabels, (settings.bill_item_style ?? 'name_qty') as ReceiptItemStyle),
    billLayout,
    billW,
    true
  );

  const kotText = renderKotText(
    buildSampleKotModel(kotPreviewLabels, (settings.kot_item_style ?? 'name_qty') as ReceiptItemStyle),
    kotLayout,
    kotW
  );

  const billFontPx = 7 * fontScale(settings.bill_font_size ?? 'small');
  const kotFontPx = 7 * fontScale(settings.kot_font_size ?? 'small');

  // Field Editor helpers
  const renderFieldEditorList = (kind: 'bill' | 'kot') => {
    const defs: ReceiptFieldDef[] = kind === 'bill' ? BILL_FIELD_DEFS : KOT_FIELD_DEFS;
    const key = kind === 'bill' ? 'bill_layout' : 'kot_layout';
    const layout: ReceiptLayout = mergeLayout(settings[key], defs);

    const persist = (next: ReceiptLayout) => {
      void setSetting(key, JSON.stringify(next));
    };

    const toggleVisible = (id: string) =>
      persist(
        layout.map((c) => {
          if (c.id !== id) return c;
          if (getFieldDef(defs, id)?.core) return c;
          return { ...c, visible: !c.visible };
        })
      );

    const rename = (id: string, label: string) =>
      persist(
        layout.map((c) => (c.id === id ? { ...c, label: label.trim() ? label : undefined } : c))
      );

    const reorder = (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= layout.length || to >= layout.length) return;
      const next = [...layout];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      persist(next);
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div>
            <span className="text-xs font-semibold text-gray-800">
              {kind === 'bill'
                ? t('settingsPage.receiptFields.billTitle', 'Customer Bill Fields')
                : t('settingsPage.receiptFields.kotTitle', 'Kitchen KOT Fields')}
            </span>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {t('settingsPage.receiptFields.hint', 'Drag to reorder, click eye to show/hide, or enter a custom label.')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => persist(defaultLayout(defs))}
            className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <RotateCcw size={12} />
            <span>{t('settingsPage.receiptFields.reset', 'Reset Layout')}</span>
          </button>
        </div>

        <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
          {layout.map((cfg, i) => {
            const def = getFieldDef(defs, cfg.id);
            if (!def) return null;
            const draggable = isReorderable(def);
            const name = t(`settingsPage.receiptFields.${kind}.${cfg.id}`, def.id);
            const isDragging = dragField?.kind === kind && dragField.index === i;
            const isDragOver = dragOverField?.kind === kind && dragOverField.index === i && !isDragging;

            return (
              <div
                key={cfg.id}
                draggable={draggable}
                onDragStart={(e) => {
                  if (!draggable) return;
                  setDragField({ kind, index: i });
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnter={() => {
                  if (dragField?.kind === kind) setDragOverField({ kind, index: i });
                }}
                onDragOver={(e) => {
                  if (dragField?.kind === kind) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragField?.kind === kind) reorder(dragField.index, i);
                  setDragField(null);
                  setDragOverField(null);
                }}
                onDragEnd={() => {
                  setDragField(null);
                  setDragOverField(null);
                }}
                className={`flex items-center gap-2.5 bg-white rounded-lg px-3 py-2 border transition-all ${
                  isDragOver
                    ? 'border-blue-500 border-dashed bg-blue-50/40'
                    : 'border-gray-200 shadow-2xs hover:border-gray-300'
                } ${isDragging ? 'opacity-40' : ''}`}
              >
                <span
                  className={
                    draggable
                      ? 'text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing'
                      : 'text-gray-200 cursor-not-allowed'
                  }
                >
                  <GripVertical size={14} />
                </span>
                <button
                  type="button"
                  onClick={() => toggleVisible(cfg.id)}
                  disabled={!!def.core}
                  title={def.core ? t('settingsPage.receiptFields.alwaysOn', 'Always shown') : ''}
                  className={`shrink-0 transition-colors ${
                    def.core
                      ? 'opacity-30 cursor-not-allowed text-gray-400'
                      : cfg.visible
                      ? 'text-blue-600 hover:text-blue-800'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {cfg.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <span
                  className={`text-xs flex-1 truncate font-medium ${
                    cfg.visible ? 'text-gray-800' : 'text-gray-400 line-through'
                  }`}
                >
                  {name}
                </span>
                {def.core && (
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-normal">
                    Required
                  </span>
                )}
                {def.renamable && (
                  <ReceiptFieldLabelInput
                    value={cfg.label ?? ''}
                    placeholder={t('settingsPage.receiptFields.labelPlaceholder', 'Custom label')}
                    onCommit={(label) => rename(cfg.id, label)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              {t('settingsPage.printerSetup', 'Printer Setup')}
            </h2>
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
              Hardware Suite
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {t(
              'settingsPage.printerSetupDesc',
              'Configure thermal printers, station routing, print engine, and receipt styling.'
            )}
          </p>
        </div>

        {/* Printer Hardware Status & Refresh */}
        <div className="flex items-center gap-2.5">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              printerList.length > 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                printerList.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>
              {printerList.length > 0
                ? t('settingsPage.printersFound', {
                    count: printerList.length,
                    defaultValue: `${printerList.length} Printers Found`,
                  })
                : t('settingsPage.printersLoadHint', 'No Printers Found')}
            </span>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={printersLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            onClick={loadPrinters}
            loading={printersLoading}
          >
            {t('settingsPage.refreshPrinters', 'Scan')}
          </Button>
        </div>
      </div>

      {/* Enterprise Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-gray-100/90 rounded-xl border border-gray-200/80 overflow-x-auto">
        {[
          { key: 'devices', label: 'Devices & Routing', icon: <Printer size={15} /> },
          { key: 'format', label: 'Paper & Typography', icon: <SlidersHorizontal size={15} /> },
          { key: 'template', label: 'Receipt & UPI QR', icon: <FileText size={15} /> },
          {
            key: 'fields',
            label: 'Receipt Fields',
            icon: <Layers size={15} />,
            badge: normalizePrintMode(settings.print_mode) === 'raster' ? 'Raster' : 'HTML (Locked)',
          },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as PrinterSubTab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                isActive
                  ? 'bg-white text-gray-900 shadow-xs border border-gray-200/80'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-normal ${
                    normalizePrintMode(settings.print_mode) === 'raster'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Studio Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Control Panels (7 Columns on Large Screens) */}
        <div className="lg:col-span-7 space-y-5">
          {/* =========================================================================
              TAB 1: DEVICES & ROUTING
          ========================================================================= */}
          {activeTab === 'devices' && (
            <div className="space-y-4">
              {/* Primary Bill Printer Card */}
              <div className="bg-white rounded-xl border border-gray-200/90 p-4 shadow-2xs space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Receipt size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-gray-900">
                          {t('settingsPage.billPrinter', 'Guest Bill Printer')}
                        </h4>
                        {settings.printer_bill ? (
                          printerList.some((p) => p.name === settings.printer_bill) ? (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.2 rounded-full">
                              Online
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.2 rounded-full">
                              Offline
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.2 rounded-full">
                            System Dialog
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Primary thermal printer for guest receipts, settlements & tax invoices.
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    icon={testingBill ? <Loader2 size={13} className="animate-spin" /> : <TestTube size={13} />}
                    onClick={handleTestBill}
                    loading={testingBill}
                    className="shrink-0"
                  >
                    {t('settingsPage.testBillPrint', 'Test Print')}
                  </Button>
                </div>

                <div>
                  <select
                    value={settings.printer_bill ?? ''}
                    onChange={(e) => handleUpdateSetting('printer_bill', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none bg-white font-medium text-gray-800"
                  >
                    <option value="">{t('settingsPage.printerNoneOption', '— None (use system print dialog) —')}</option>
                    {printerList.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.displayName}
                        {p.isDefault ? t('settingsPage.printerDefaultSuffix', ' (Default)') : ''}
                      </option>
                    ))}
                  </select>

                  {settings.printer_bill && !printerList.find((p) => p.name === settings.printer_bill) && printerList.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 mt-2 bg-amber-50 border border-amber-200/80 px-2.5 py-1.5 rounded-md">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{t('settingsPage.printerNotFoundWarn', { name: settings.printer_bill })}</span>
                    </div>
                  )}
                </div>

                {/* Bill Automation Switches */}
                <div className="pt-2 border-t border-gray-100 space-y-2.5">
                  <div className="flex items-center justify-between p-2.5 bg-gray-50/70 rounded-lg border border-gray-100">
                    <div>
                      <p className="text-xs font-semibold text-gray-800">
                        {t('settingsPage.autoPrintBillTitle', 'Auto Print Bill on Payment')}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {t('settingsPage.autoPrintBillDesc', 'Automatically print bill when payment is completed')}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.auto_print_bill === 'true'}
                      onClick={() => handleToggleSetting('auto_print_bill')}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        settings.auto_print_bill === 'true' ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          settings.auto_print_bill === 'true' ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-gray-50/70 rounded-lg border border-gray-100">
                    <div>
                      <p className="text-xs font-semibold text-gray-800">
                        {t('settingsPage.centerBillPrintTitle', 'Center Bill on Print')}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {t('settingsPage.centerBillPrintDesc', 'Center the receipt horizontally when printing on wide rolls')}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.bill_center_print === 'true'}
                      onClick={() => handleToggleSetting('bill_center_print')}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        settings.bill_center_print === 'true' ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          settings.bill_center_print === 'true' ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Kitchen KOT Printer Card */}
              <div className="bg-white rounded-xl border border-gray-200/90 p-4 shadow-2xs space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                      <ChefHat size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-gray-900">
                          {t('settingsPage.kotPrinter', 'Kitchen Order Ticket (KOT) Printer')}
                        </h4>
                        {settings.printer_kot ? (
                          printerList.some((p) => p.name === settings.printer_kot) ? (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.2 rounded-full">
                              Online
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.2 rounded-full">
                              Offline
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.2 rounded-full">
                            System Dialog
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Default thermal printer used for cooking preparation tickets.
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    icon={testingKot ? <Loader2 size={13} className="animate-spin" /> : <TestTube size={13} />}
                    onClick={handleTestKot}
                    loading={testingKot}
                    className="shrink-0"
                  >
                    {t('settingsPage.testKotPrint', 'Test Print')}
                  </Button>
                </div>

                <div>
                  <select
                    value={settings.printer_kot ?? ''}
                    onChange={(e) => handleUpdateSetting('printer_kot', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none bg-white font-medium text-gray-800"
                  >
                    <option value="">{t('settingsPage.printerNoneOption', '— None (use system print dialog) —')}</option>
                    {printerList.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.displayName}
                        {p.isDefault ? t('settingsPage.printerDefaultSuffix', ' (Default)') : ''}
                      </option>
                    ))}
                  </select>

                  {settings.printer_kot && !printerList.find((p) => p.name === settings.printer_kot) && printerList.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 mt-2 bg-amber-50 border border-amber-200/80 px-2.5 py-1.5 rounded-md">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{t('settingsPage.printerNotFoundWarn', { name: settings.printer_kot })}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Multi-Station Kitchen Routing Card */}
              <div className="bg-white rounded-xl border border-gray-200/90 p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <GitFork size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-gray-900">
                          {t('settingsPage.multiStationKotPrinting', 'Multi-Station KOT Printing')}
                        </h4>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.2 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Smart Routing
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t(
                          'settingsPage.multiStationKotPrintingDesc',
                          'Route KOT tickets to dedicated printers for Bar, Grill, or Kitchen.'
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.multi_station_kot_printing === 'true'}
                    onClick={() => {
                      const nextVal = settings.multi_station_kot_printing === 'true' ? 'false' : 'true';
                      handleUpdateSetting('multi_station_kot_printing', nextVal);
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.multi_station_kot_printing === 'true' ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.multi_station_kot_printing === 'true' ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {settings.multi_station_kot_printing === 'true' && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                    <p className="text-[11px] text-gray-500">
                      {t(
                        'settingsPage.stationPrintersDesc',
                        'Assign a dedicated printer for each kitchen station. Unassigned stations will use the Default KOT Printer.'
                      )}
                    </p>

                    {(() => {
                      let stationMap: Record<string, string> = {};
                      try {
                        stationMap = JSON.parse(settings.station_printers || '{}');
                      } catch {
                        stationMap = {};
                      }

                      const stations = [
                        { key: 'main_kitchen', label: t('kitchen.stationMainKitchen', 'Main Kitchen'), icon: <ChefHat size={15} className="text-orange-500" /> },
                        { key: 'tandoor', label: t('kitchen.stationTandoor', 'Tandoor / Grill'), icon: <Flame size={15} className="text-red-500" /> },
                        { key: 'bar', label: t('kitchen.stationBar', 'Bar & Beverages'), icon: <Wine size={15} className="text-purple-500" /> },
                        { key: 'dessert', label: t('kitchen.stationDessert', 'Dessert & Bakery'), icon: <Cake size={15} className="text-pink-500" /> },
                      ];

                      const handleStationChange = (stationKey: string, val: string) => {
                        const nextMap = { ...stationMap };
                        if (val) {
                          nextMap[stationKey] = val;
                        } else {
                          delete nextMap[stationKey];
                        }
                        handleUpdateSetting('station_printers', JSON.stringify(nextMap));
                      };

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {stations.map((st) => {
                            const selectedPrinter = stationMap[st.key] ?? '';
                            return (
                              <div key={st.key} className="bg-gray-50/80 p-2.5 rounded-lg border border-gray-200 shadow-2xs">
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 mb-1.5">
                                  {st.icon}
                                  <span>{st.label}</span>
                                </label>
                                <select
                                  value={selectedPrinter}
                                  onChange={(e) => handleStationChange(st.key, e.target.value)}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none bg-white text-gray-800"
                                >
                                  <option value="">
                                    {settings.printer_kot
                                      ? `${t('settingsPage.stationUseDefault', '— Default KOT Printer —')} (${settings.printer_kot})`
                                      : t('settingsPage.stationUseDefault', '— Default KOT Printer —')}
                                  </option>
                                  {printerList.map((p) => (
                                    <option key={p.name} value={p.name}>
                                      {p.displayName}
                                      {p.isDefault ? t('settingsPage.printerDefaultSuffix', ' (Default)') : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 2: PAPER & TYPOGRAPHY
          ========================================================================= */}
          {activeTab === 'format' && (
            <div className="space-y-4">
              {/* Thermal Paper Roll Width Card */}
              <div className="bg-white rounded-xl border border-gray-200/90 p-4 shadow-2xs space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">
                    {t('settingsPage.paperWidth', 'Thermal Paper Roll Width')}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Select your printer roll width to automatically calculate character line wrapping.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { key: '58mm', label: '58 mm', spec: '2" Mobile / POS', cols: '32 cols' },
                    { key: '72mm', label: '72 mm', spec: '2.8" Compact', cols: '38 cols' },
                    { key: '76mm', label: '76 mm', spec: '3" Impact', cols: '40 cols' },
                    { key: '80mm', label: '80 mm', spec: '3" Standard POS', cols: '42 cols', popular: true },
                    { key: '112mm', label: '112 mm', spec: '4.4" Wide', cols: '56 cols' },
                  ].map((w) => {
                    const isSelected = (settings.paper_width ?? '58mm') === w.key;
                    return (
                      <button
                        key={w.key}
                        type="button"
                        onClick={() => handleUpdateSetting('paper_width', w.key)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-2xs'
                            : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-bold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                            {w.label}
                          </span>
                          {w.popular && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                              Standard
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">{w.spec}</p>
                        <span className="text-[10px] font-mono text-gray-400 mt-0.5 block">{w.cols}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Print Engine Card */}
              <div className="bg-white rounded-xl border border-gray-200/90 p-4 shadow-2xs space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">
                    {t('settingsPage.printMode', 'Print Engine Architecture')}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Choose between raw binary ESC/POS thermal rendering or standard operating system driver spooling.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      key: 'raster',
                      title: 'Raster ESC/POS (Recommended)',
                      badge: 'High Performance',
                      desc: 'Pixel-perfect thermal output with dynamic UPI QR codes, customizable fields, and crisp logo rendering.',
                    },
                    {
                      key: 'html',
                      title: 'HTML Spooler',
                      badge: 'Legacy Driver',
                      desc: 'Standard Windows/macOS print spooler via web browser layout engine. Fallback for non-ESC/POS printers.',
                    },
                  ].map((m) => {
                    const isSelected = normalizePrintMode(settings.print_mode) === m.key;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => handleUpdateSetting('print_mode', m.key)}
                        className={`p-3.5 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-2xs'
                            : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-bold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                            {m.title}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {m.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 leading-relaxed">{m.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Typography Scaling Card */}
              <div className="bg-white rounded-xl border border-gray-200/90 p-4 shadow-2xs space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Typography & Font Scaling</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Adjust text scaling for thermal receipts. Changes instantly reflect in the live simulator.
                  </p>
                </div>

                <div className="space-y-3.5">
                  {/* Bill Font Scale */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      {t('settingsPage.billFontSize', 'Bill Font Size')}
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { key: 'small', label: t('settingsPage.fontSize.small', 'Small'), scale: '1x' },
                        { key: 'regular', label: t('settingsPage.fontSize.regular', 'Regular'), scale: '1.5x' },
                        { key: 'medium', label: t('settingsPage.fontSize.medium', 'Medium'), scale: '2x H' },
                        { key: 'large', label: t('settingsPage.fontSize.large', 'Large'), scale: '2x' },
                      ].map((s) => {
                        const isSelected = (settings.bill_font_size ?? 'small') === s.key;
                        return (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => handleUpdateSetting('bill_font_size', s.key)}
                            className={`py-2 px-2.5 rounded-lg border text-center transition-all ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold ring-1 ring-blue-500 shadow-2xs'
                                : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <span className="text-xs block">{s.label}</span>
                            <span className="text-[10px] text-gray-400 font-normal">{s.scale}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* KOT Font Scale */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      {t('settingsPage.kotFontSize', 'KOT Font Size')}
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { key: 'small', label: t('settingsPage.fontSize.small', 'Small'), scale: '1x' },
                        { key: 'regular', label: t('settingsPage.fontSize.regular', 'Regular'), scale: '1.5x' },
                        { key: 'medium', label: t('settingsPage.fontSize.medium', 'Medium'), scale: '2x H' },
                        { key: 'large', label: t('settingsPage.fontSize.large', 'Large'), scale: '2x' },
                      ].map((s) => {
                        const isSelected = (settings.kot_font_size ?? 'small') === s.key;
                        return (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => handleUpdateSetting('kot_font_size', s.key)}
                            className={`py-2 px-2.5 rounded-lg border text-center transition-all ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold ring-1 ring-blue-500 shadow-2xs'
                                : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <span className="text-xs block">{s.label}</span>
                            <span className="text-[10px] text-gray-400 font-normal">{s.scale}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* KOT Count Mode */}
              <div className="bg-white rounded-xl border border-gray-200/90 p-4 shadow-2xs space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">
                    {t('settingsPage.kotCountMode', 'KOT Order Sequence Counter')}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t('settingsPage.kotCountModeDesc', 'Controls the counter shown on printed KOT receipts.')}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {(['daily', 'total'] as const).map((mode) => {
                    const isSelected = (settings.kot_count_mode ?? 'daily') === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => handleUpdateSetting('kot_count_mode', mode)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-semibold ring-1 ring-blue-500'
                            : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-xs block font-bold">
                          {t(`settingsPage.kotCountMode_${mode}`, mode === 'daily' ? 'Daily Counter' : 'Total Sequence')}
                        </span>
                        <span className="text-[11px] text-gray-500 block mt-0.5 font-normal">
                          {mode === 'daily' ? 'Resets back to #1 every morning' : 'Continuous running ticket counter'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 3: RECEIPT DESIGN & DYNAMIC UPI QR
          ========================================================================= */}
          {activeTab === 'template' && (
            <div className="space-y-4">
              {/* Item Line Format Selector */}
              <div className="bg-white rounded-xl border border-gray-200/90 p-4 shadow-2xs space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Receipt Item Listing Format</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Choose how menu items, quantities, and line amounts align on printed tickets.
                  </p>
                </div>

                {/* Bill Item Format */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    {t('settingsPage.billItemStyle', 'Customer Bill Item Format')}
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { key: 'name_qty', title: 'Item Name ... Qty', sample: 'Pizza .......... 3   ₹990' },
                      { key: 'qty_x_name', title: 'Qty x Item Name', sample: '3 x Pizza ........ ₹990' },
                      { key: 'qty_name', title: 'Qty  Item Name', sample: '  3  Pizza ........ ₹990' },
                      { key: 'sno_name_qty', title: 'S.No. Item ... Qty', sample: '1. Pizza ....... 3   ₹990' },
                    ].map((st) => {
                      const isSelected = (settings.bill_item_style ?? 'name_qty') === st.key;
                      return (
                        <button
                          key={st.key}
                          type="button"
                          onClick={() => handleUpdateSetting('bill_item_style', st.key)}
                          className={`p-2.5 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-1 ring-blue-500 shadow-2xs'
                              : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-xs font-bold block">{st.title}</span>
                          <span className="text-[10px] font-mono text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded mt-1.5 block truncate">
                            {st.sample}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* KOT Item Format */}
                <div className="pt-3 border-t border-gray-100">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    {t('settingsPage.kotItemStyle', 'Kitchen KOT Item Format')}
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { key: 'name_qty', title: 'Item Name ... Qty', sample: 'Margarita Pizza .... 3' },
                      { key: 'qty_x_name', title: 'Qty x Item Name', sample: '3 x Margarita Pizza' },
                      { key: 'qty_name', title: 'Qty  Item Name', sample: '  3  Margarita Pizza' },
                      { key: 'sno_name_qty', title: 'S.No. Item ... Qty', sample: '1. Margarita Pizza .. 3' },
                    ].map((st) => {
                      const isSelected = (settings.kot_item_style ?? 'name_qty') === st.key;
                      return (
                        <button
                          key={st.key}
                          type="button"
                          onClick={() => handleUpdateSetting('kot_item_style', st.key)}
                          className={`p-2.5 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-1 ring-blue-500 shadow-2xs'
                              : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-xs font-bold block">{st.title}</span>
                          <span className="text-[10px] font-mono text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded mt-1.5 block truncate">
                            {st.sample}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Dynamic UPI Payment QR Card */}
              <div className="bg-white rounded-xl border border-gray-200/90 p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <QrCode size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-gray-900">
                          {t('settingsPage.dynamicQrTitle', 'Dynamic UPI Payment QR')}
                        </h4>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Scan to Pay
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t(
                          'settingsPage.dynamicQrDesc',
                          'Print dynamic payment QR code with the exact bill total on customer receipts.'
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.dynamic_qr_bill === 'true'}
                    onClick={() => handleToggleSetting('dynamic_qr_bill')}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.dynamic_qr_bill === 'true' ? 'bg-emerald-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.dynamic_qr_bill === 'true' ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {settings.dynamic_qr_bill === 'true' && (
                  <div className="pt-3 border-t border-gray-100 space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          {t('settingsPage.upiIdLabel', 'UPI ID / VPA')}
                        </label>
                        <input
                          type="text"
                          value={settings.upi_id ?? ''}
                          onChange={(e) => handleUpdateSetting('upi_id', e.target.value)}
                          placeholder={t('settingsPage.upiIdPlaceholder', 'e.g. restaurant@upi')}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          {t('settingsPage.upiPayeeNameLabel', 'Payee Business Name')}
                        </label>
                        <input
                          type="text"
                          value={settings.upi_payee_name ?? ''}
                          onChange={(e) => handleUpdateSetting('upi_payee_name', e.target.value)}
                          placeholder={t('settingsPage.upiPayeeNamePlaceholder', 'Store or Restaurant Name')}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        {t('settingsPage.qrStyleLabel', 'QR Code Visual Pattern & Corners')}
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {QR_STYLES.map((st) => {
                          const isSelected = (settings.qr_style ?? 'square') === st.id;
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => handleUpdateSetting('qr_style', st.id)}
                              className={`flex flex-col items-center p-2.5 rounded-lg border text-center transition-all ${
                                isSelected
                                  ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 shadow-2xs ring-1 ring-emerald-500'
                                  : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              <div
                                className="w-12 h-12 mb-1 p-1 bg-white border border-gray-200 rounded shadow-2xs flex items-center justify-center overflow-hidden [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
                                dangerouslySetInnerHTML={{
                                  __html: renderQrSvg('upi://pay?pa=demo@upi', st.id, 1),
                                }}
                              />
                              <span className="text-[11px] font-semibold leading-tight">{st.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 4: RECEIPT FIELDS DESIGNER
          ========================================================================= */}
          {activeTab === 'fields' && (
            <div className="space-y-4">
              {normalizePrintMode(settings.print_mode) === 'raster' ? (
                <div className="bg-white rounded-xl border border-gray-200/90 p-4 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">
                        {t('settingsPage.receiptFields.title', 'Receipt Fields & Layout Customizer')}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Drag to reorder sections, toggle visibility, and rename labels.
                      </p>
                    </div>

                    <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setFieldEditorKind('bill')}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                          fieldEditorKind === 'bill'
                            ? 'bg-white text-gray-900 shadow-xs'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        Bill
                      </button>
                      <button
                        type="button"
                        onClick={() => setFieldEditorKind('kot')}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                          fieldEditorKind === 'kot'
                            ? 'bg-white text-gray-900 shadow-xs'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        KOT
                      </button>
                    </div>
                  </div>

                  {renderFieldEditorList(fieldEditorKind)}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-900">Raster Mode Required for Layout Customization</h4>
                    <p className="text-xs text-amber-700 mt-1 max-w-md mx-auto">
                      Receipt field drag-and-drop reordering, custom field renaming, and visibility toggling are exclusive features of the high-performance Raster ESC/POS print engine.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Zap size={14} />}
                    onClick={() => handleUpdateSetting('print_mode', 'raster')}
                  >
                    Switch to Raster Engine
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Sticky Thermal Receipt Simulator (5 Columns on Large Screens) */}
        <div className="lg:col-span-5 lg:sticky lg:top-4 space-y-3">
          <div className="bg-white rounded-xl border border-gray-200/90 p-4 shadow-2xs space-y-3.5">
            {/* Simulator Header & Switcher */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                  Live Thermal Simulator
                </span>
              </div>

              <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => setPreviewKind('bill')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    previewKind === 'bill'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Bill Receipt
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewKind('kot')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    previewKind === 'kot'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  KOT Ticket
                </button>
              </div>
            </div>

            {/* Simulated Paper Roll */}
            <div className="bg-gradient-to-b from-gray-100 via-gray-100 to-gray-200/90 rounded-xl p-3.5 border border-gray-200/80 shadow-inner flex flex-col items-center">
              <div className="w-full max-w-[320px] bg-white rounded-t-sm rounded-b-md shadow-md border-t-4 border-dashed border-gray-300 px-3.5 py-4 font-mono text-gray-800 transition-all text-center">
                {previewKind === 'bill' ? (
                  <>
                    {isFieldVisible(billLayout, 'logo') && (
                      <div className="mb-2.5 flex flex-col items-center text-gray-400">
                        <div className="w-12 h-12 rounded-md border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                          <ImageIcon size={20} className="text-gray-400" />
                        </div>
                        <span className="text-[8px] uppercase tracking-wider mt-0.5 text-gray-400 font-sans font-medium">
                          {t('settingsPage.receiptFields.bill.logo', 'Logo')}
                        </span>
                      </div>
                    )}
                    <pre
                      className="whitespace-pre text-left leading-tight inline-block"
                      style={{ fontSize: `${billFontPx}px` }}
                    >
                      {billText}
                    </pre>
                    {settings.dynamic_qr_bill === 'true' && (
                      <div className="mt-2.5 pt-2 border-t border-dashed border-gray-300 text-center">
                        <div
                          className="w-16 h-16 mx-auto bg-white p-1 border rounded shadow-2xs flex items-center justify-center overflow-hidden [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
                          dangerouslySetInnerHTML={{
                            __html: renderQrSvg(
                              generateUpiUrl({
                                upiId: settings.upi_id || 'demo@upi',
                                payeeName: settings.upi_payee_name || restaurant?.name || 'Cafe',
                                restaurantName: restaurant?.name || settings.upi_payee_name || 'Cafe',
                                amount: 315.0,
                                orderNo: '001',
                              }),
                              (settings.qr_style ?? 'square') as QrStyle,
                              1
                            ),
                          }}
                        />
                        <span className="text-[8px] uppercase tracking-wider text-gray-600 block mt-1 font-bold font-sans">
                          UPI QR ({QR_STYLES.find((s) => s.id === (settings.qr_style ?? 'square'))?.name || 'Classic'})
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <pre
                    className="whitespace-pre text-left leading-tight inline-block"
                    style={{ fontSize: `${kotFontPx}px` }}
                  >
                    {kotText}
                  </pre>
                )}
              </div>

              {/* Thermal Specs Footer */}
              <div className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-gray-500 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-full border border-gray-200 shadow-2xs">
                <span className="font-semibold text-gray-700">{paperWidth}</span>
                <span>•</span>
                <span>{printMode === 'raster' ? 'Raster ESC/POS' : 'HTML Spooler'}</span>
                <span>•</span>
                <span>{previewKind === 'bill' ? billW : kotW} cols</span>
              </div>

              {/* Direct Test Action Button */}
              <div className="w-full mt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center shadow-xs bg-white hover:bg-gray-50 border-gray-300"
                  icon={
                    (previewKind === 'bill' ? testingBill : testingKot) ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Printer size={13} />
                    )
                  }
                  onClick={previewKind === 'bill' ? handleTestBill : handleTestKot}
                  loading={previewKind === 'bill' ? testingBill : testingKot}
                >
                  {previewKind === 'bill'
                    ? t('settingsPage.testBillPrint', 'Test Bill Print')
                    : t('settingsPage.testKotPrint', 'Test KOT Print')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrinterSettings;
