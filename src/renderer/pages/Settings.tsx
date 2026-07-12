import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Building2,
  Receipt,
  Printer,
  CreditCard,
  Database,
  Sun,
  Loader2,
  AlertCircle,
  Save,
  Upload,
  Download,
  Play,
  TestTube,
  ToggleLeft,
  ToggleRight,
  Lock,
  Unlock,
  Clock,
  Check,
  FileText,
  Banknote,
  Smartphone,
  TrendingUp,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Tag,
  Plus,
  Trash2,
  Pencil,
  X,
  Moon,
  Palette,
  Coins,
  Wifi,
  RefreshCw,
  Copy,
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
  Image as ImageIcon,
  Cloud,
} from 'lucide-react';
import { useLicenseStore } from '../stores/license.store';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { formatCurrency, formatDateTime } from '../lib/formatters';
import { useSettings } from '../hooks/useSettings';
import { ipc } from '../lib/ipc';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import i18n from '../lib/i18n';
import { Globe } from 'lucide-react';
import { LOCALE_CODES, type LocaleCode } from '../locales';
import {
  COUNTRIES,
  getCountryById,
  LOCALE_DISPLAY,
  type CountryId,
} from '../lib/countryLocale';
import { useCountryStore } from '../stores/country.store';
import { useTaxTerminology } from '../hooks/useTaxTerminology';
import { useLocaleCurrencyIcon } from '../hooks/useLocaleCurrencyIcon';
import { currencySymbolForLanguage } from '../lib/currencyLocale';
import { formatSlabSplitLine } from '../lib/taxTerminology';
import {
  getTaxRegionForLanguage,
  TAX_LOCALE_PRESETS,
  type TaxRegion,
} from '../lib/taxLocalePresets';
import { setStoredTaxConfigForRegion } from '../lib/taxConfigByRegion';
import { WHATSAPP_FEATURE_ENABLED } from '../../shared/featureFlags';
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
} from '../../shared/receipt-layout';
import {
  renderBillText,
  renderKotText,
  buildSampleBillModel,
  buildSampleKotModel,
  computePrintLineWidth,
  fontScale,
  type ReceiptItemStyle,
} from '../../shared/receipt-render';
import { useUIStore } from '../stores/ui.store';
import { useDaySessionStore } from '../stores/daySession.store';

type SettingsSection = 'restaurant' | 'tax' | 'printer' | 'billing' | 'offers' | 'backup' | 'cloud' | 'day_session' | 'license' | 'language' | 'appearance' | 'coins' | 'kitchen_network' | 'waiter_network' | 'system_update';

const SECTION_DEFS: { key: SettingsSection; labelKey: string; icon: React.ReactNode }[] = [
  { key: 'restaurant', labelKey: 'settingsPage.restaurantProfile', icon: <Building2 size={18} /> },
  { key: 'tax', labelKey: 'settingsPage.taxConfiguration', icon: <Receipt size={18} /> },
  { key: 'printer', labelKey: 'settingsPage.printerSetup', icon: <Printer size={18} /> },
  { key: 'billing', labelKey: 'settingsPage.billingSettings', icon: <CreditCard size={18} /> },
  { key: 'offers', labelKey: 'settings.offers', icon: <Tag size={18} /> },
  { key: 'backup', labelKey: 'settings.backup', icon: <Database size={18} /> },
  { key: 'cloud', labelKey: 'settings.cloud', icon: <Cloud size={18} /> },
  { key: 'day_session', labelKey: 'settings.daySession', icon: <Sun size={18} /> },
  { key: 'license', labelKey: 'settings.license', icon: <KeyRound size={18} /> },
  { key: 'appearance', labelKey: 'settings.appearance', icon: <Palette size={18} /> },
  { key: 'language', labelKey: 'settings.regionLanguage', icon: <Globe size={18} /> },
  { key: 'coins', labelKey: 'settings.coins', icon: <Coins size={18} /> },
  { key: 'kitchen_network', labelKey: 'settings.kitchenNetwork', icon: <Wifi size={18} /> },
  { key: 'waiter_network', labelKey: 'settings.waiterNetwork', icon: <Smartphone size={18} /> },
  { key: 'system_update', labelKey: 'settings.systemUpdate', icon: <RefreshCw size={18} /> },
];

// Group sections into labelled categories for a modern, professional-software
// settings layout. Every section appears exactly once across these groups.
const SECTION_GROUPS: { labelKey: string; fallback: string; keys: SettingsSection[] }[] = [
  { labelKey: 'settingsPage.groupGeneral', fallback: 'General', keys: ['restaurant', 'appearance', 'language'] },
  { labelKey: 'settingsPage.groupSales', fallback: 'Sales & Billing', keys: ['tax', 'billing', 'offers', 'coins'] },
  { labelKey: 'settingsPage.groupDevices', fallback: 'Devices & Network', keys: ['printer', 'kitchen_network', 'waiter_network'] },
  { labelKey: 'settingsPage.groupSystem', fallback: 'System', keys: ['backup', 'cloud', 'day_session', 'license', 'system_update'] },
];

const SETTING_KEYS = [
  'default_tax_rate',
  'tax_inclusive',
  'bill_prefix',
  'kot_prefix',
  'enable_tips',
  'default_order_type',
  'round_off',
  'auto_print_bill',
  'bill_center_print',
  'printer_bill',
  'printer_kot',
  'paper_width',
  'kot_item_style',
  'kot_count_mode',
  'bill_item_style',
  'kot_font_size',
  'bill_font_size',
  'print_mode',
  'bill_layout',
  'kot_layout',
  'auto_backup',
  'last_backup',
  'last_supabase_backup',
  'whatsapp_enabled',
  'chatmitra_api_key',
  'coins_enabled',
  'coin_slabs',
  'show_menu_prices',
];

// Stable, locally-buffered input for renaming a receipt field. Edits are held in
// local state and committed on blur / Enter so we don't write to the DB (and
// re-render every preview) on each keystroke — which also avoids an async
// out-of-order race that could drop typed characters.
const ReceiptFieldLabelInput: React.FC<{
  value: string;
  placeholder: string;
  onCommit: (label: string) => void;
}> = ({ value, placeholder, onCommit }) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  const commit = () => { if (draft !== value) onCommit(draft); };
  return (
    <input
      type="text"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      onDragStart={(e) => e.stopPropagation()}
      draggable={false}
      className="w-24 text-[11px] border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
    />
  );
};

const Settings: React.FC = () => {
  const licenseStatus = useLicenseStore((s) => s.status);
  const { t, i18n } = useTranslation();
  const CurrencyIcon = useLocaleCurrencyIcon();
  const countryId = useCountryStore((s) => s.countryId);
  const setCountryId = useCountryStore((s) => s.setCountryId);
  const taxTerms = useTaxTerminology();
  const taxRegion: TaxRegion = getTaxRegionForLanguage(i18n.language);
  const taxLocalePreset = TAX_LOCALE_PRESETS[taxRegion];

  const sectionNavItems = useMemo(
    () => SECTION_DEFS.map((def) => ({ ...def, label: t(def.labelKey) })),
    [t, i18n.language],
  );

  const {
    restaurant,
    settings,
    currentSession,
    loading,
    error,
    fetchRestaurant,
    updateRestaurant,
    setSetting,
    fetchSettings,
    fetchCurrentSession,
    openDaySession,
    closeDaySession,
  } = useSettings();

  const currentTheme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const [activeSection, setActiveSection] = useState<SettingsSection>('restaurant');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [restFormDirty, setRestFormDirty] = useState(false);

  // Restaurant form state
  const [restForm, setRestForm] = useState({
    name: '',
    address: '',
    phone: '',
    gstin: '',
    fssai: '',
    logoPath: '' as string | undefined,
  });
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string>('');

  // Offers state
  const [offers, setOffers] = useState<any[]>([]);
  const [offerModal, setOfferModal] = useState<{ mode: 'create' | 'edit'; offer?: any } | null>(null);
  const [offerForm, setOfferForm] = useState({ name: '', type: 'percentage', value: '', minOrderAmount: '', maxDiscount: '', isActive: true });

  const fetchOffers = async () => {
    if (!window.electronAPI.offers) return;
    try { setOffers(await ipc<any[]>(window.electronAPI.offers.getAll()) ?? []); } catch { /* ignore */ }
  };

  useEffect(() => { fetchOffers(); }, []);

  const openOfferModal = (offer?: any) => {
    if (offer) {
      setOfferForm({
        name: offer.name,
        type: offer.type,
        value: String(offer.value),
        minOrderAmount: String(offer.minOrderAmount / 100),
        maxDiscount: offer.maxDiscount ? String(offer.maxDiscount / 100) : '',
        isActive: offer.isActive,
      });
      setOfferModal({ mode: 'edit', offer });
    } else {
      setOfferForm({ name: '', type: 'percentage', value: '', minOrderAmount: '', maxDiscount: '', isActive: true });
      setOfferModal({ mode: 'create' });
    }
  };

  const handleSaveOffer = async () => {
    if (!offerForm.name.trim() || !offerForm.value || !offerForm.minOrderAmount) return;
    const data = {
      name: offerForm.name.trim(),
      type: offerForm.type as 'percentage' | 'flat',
      value: parseFloat(offerForm.value),
      minOrderAmount: Math.round(parseFloat(offerForm.minOrderAmount) * 100),
      maxDiscount: offerForm.maxDiscount ? Math.round(parseFloat(offerForm.maxDiscount) * 100) : null,
      isActive: offerForm.isActive,
    };
    if (!window.electronAPI.offers) {
      toast.error(t('toast.offersUnavailable'));
      return;
    }
    try {
      if (offerModal?.mode === 'edit' && offerModal.offer) {
        await ipc(window.electronAPI.offers.update(offerModal.offer.id, data));
      } else {
        await ipc(window.electronAPI.offers.create(data));
      }
      await fetchOffers();
      setOfferModal(null);
      toast.success(offerModal?.mode === 'edit' ? t('toast.offerUpdated') : t('toast.offerCreated'));
    } catch (err: any) {
      toast.error(err?.message ?? t('toast.offerSaveFailed'));
    }
  };

  const handleDeleteOffer = async (id: number) => {
    if (!window.electronAPI.offers) return;
    if (!window.confirm(t('toast.confirmDeleteOffer'))) return;
    try {
      await ipc(window.electronAPI.offers.delete(id));
      await fetchOffers();
      toast.success(t('toast.offerDeleted'));
    } catch (err: any) {
      toast.error(err?.message ?? t('toast.offerDeleteFailed'));
    }
  };

  const handleToggleOffer = async (offer: any) => {
    if (!window.electronAPI.offers) return;
    try {
      await ipc(window.electronAPI.offers.update(offer.id, { isActive: !offer.isActive }));
      await fetchOffers();
    } catch (err: any) {
      toast.error(err?.message ?? t('toast.offerToggleFailed'));
    }
  };

  // Day session form state
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');

  // Day-end summary modal
  const [dayEndSummary, setDayEndSummary] = useState<any>(null);
  const [showDayEndSummary, setShowDayEndSummary] = useState(false);

  // Network info (covers both kitchen + waiter roles served by the same HTTP server)
  interface RoleInfo { enabled: boolean; token: string; url: string | null }
  interface NetInfo {
    running: boolean;
    port: number;
    lanAddress: string | null;
    kitchen: RoleInfo;
    waiter: RoleInfo;
  }
  const [netInfo, setNetInfo] = useState<NetInfo | null>(null);
  const [kitchenNetPortInput, setKitchenNetPortInput] = useState('');
  const [netBusy, setNetBusy] = useState(false);
  const [kitchenQr, setKitchenQr] = useState<string | null>(null);
  const [waiterQr, setWaiterQr] = useState<string | null>(null);

  const generateQr = async (url: string | null): Promise<string | null> => {
    if (!url) return null;
    try {
      const QR = await import('qrcode');
      return await QR.toDataURL(url, { margin: 1, width: 200 });
    } catch {
      return null;
    }
  };

  const refreshNetInfo = async () => {
    try {
      const info = await ipc<NetInfo>(window.electronAPI.kitchenNetwork.getInfo());
      if (info) {
        setNetInfo(info);
        setKitchenNetPortInput(String(info.port));
        setKitchenQr(await generateQr(info.kitchen.url));
        setWaiterQr(await generateQr(info.waiter.url));
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (activeSection === 'kitchen_network' || activeSection === 'waiter_network') {
      refreshNetInfo();
    }
  }, [activeSection]);

  useEffect(() => {
    void fetchSettings(SETTING_KEYS);
  }, [fetchSettings, i18n.language]);

  // System Update state
  const [appVersion, setAppVersion] = useState('');
  const [updateState, setUpdateState] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error' | 'no-update'>('idle');
  const [updateVersion, setUpdateVersion] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateError, setUpdateError] = useState('');

  // Fetch current version on mount
  useEffect(() => {
    const fetchVersion = async () => {
      if (window.electronAPI?.updater) {
        try {
          const v = await ipc<string>(window.electronAPI.updater.getVersion());
          setAppVersion(v);
        } catch (err) {
          console.error('Failed to get app version:', err);
        }
      }
    };
    fetchVersion();
  }, []);

  // Listen to autoUpdater events
  useEffect(() => {
    if (!window.electronAPI?.updater) return;

    const unsub1 = window.electronAPI.updater.onUpdateAvailable((info) => {
      setUpdateVersion(info.version);
      setUpdateState('available');
    });
    const unsub2 = window.electronAPI.updater.onDownloadProgress((p) => {
      setUpdateState('downloading');
      setDownloadProgress(Math.round(p.percent));
    });
    const unsub3 = window.electronAPI.updater.onUpdateDownloaded((info) => {
      setUpdateVersion(info.version);
      setUpdateState('ready');
    });
    const unsub4 = window.electronAPI.updater.onError((msg) => {
      // Treat checking failures as "no update available" silently
      setUpdateState('no-update');
    });
    const unsub5 = window.electronAPI.updater.onUpdateNotAvailable((info) => {
      setUpdateState('no-update');
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      unsub5();
    };
  }, []);

  const handleCheckForUpdates = async () => {
    setUpdateState('checking');
    setUpdateError('');
    try {
      const res = await ipc<any>(window.electronAPI.updater.checkForUpdates());
      if (res && res.isDev) {
        setUpdateState('no-update');
        toast(t('settings.devModeNoUpdate', 'Updates are disabled in development mode.'));
      }
    } catch (err: any) {
      setUpdateState('no-update');
    }
  };

  useEffect(() => {
    if (restaurant) {
      setRestForm({
        name: restaurant.name ?? '',
        address: restaurant.address ?? '',
        phone: restaurant.phone ?? '',
        gstin: restaurant.gstin ?? '',
        fssai: restaurant.fssai ?? '',
        logoPath: restaurant.logoPath ?? '',
      });
      if (restaurant.logoPath) {
        if (restaurant.logoPath.startsWith('data:')) {
          setLogoPreviewUrl(restaurant.logoPath);
        } else {
          ipc<string | null>(window.electronAPI.settings.getLogoDataUrl())
            .then((url) => { if (url) setLogoPreviewUrl(url); else setLogoPreviewUrl(''); })
            .catch(() => setLogoPreviewUrl(''));
        }
      } else {
        setLogoPreviewUrl('');
      }
    }
  }, [restaurant]);

  // Derive dirty state by comparing form values to saved restaurant
  useEffect(() => {
    if (!restaurant) { setRestFormDirty(false); return; }
    const dirty =
      restForm.name !== (restaurant.name ?? '') ||
      restForm.address !== (restaurant.address ?? '') ||
      restForm.phone !== (restaurant.phone ?? '') ||
      restForm.gstin !== (restaurant.gstin ?? '') ||
      restForm.fssai !== (restaurant.fssai ?? '') ||
      restForm.logoPath !== (restaurant.logoPath ?? '');
    setRestFormDirty(dirty);
  }, [restForm, restaurant]);

  const showSaveConfirmation = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleSaveRestaurant = async () => {
    setSaving(true);
    try {
      await updateRestaurant(restForm);
      showSaveConfirmation();
    } catch {
      // Error is set in hook
    } finally {
      setSaving(false);
    }
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error(t('settingsPage.logoHint'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('settingsPage.imageTooLarge'));
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setLogoPreviewUrl(dataUrl);
      setRestForm(prev => ({ ...prev, logoPath: dataUrl }));
      await updateRestaurant({ logoPath: dataUrl });
      toast.success(t('settingsPage.saved'));
    } catch {
      toast.error(t('settingsPage.logoHint'));
    }
  };

  const handleRemoveLogo = async () => {
    setRestForm(prev => ({ ...prev, logoPath: '' }));
    setLogoPreviewUrl('');
    try {
      await updateRestaurant({ logoPath: '' });
      toast.success(t('settingsPage.saved'));
    } catch {
      toast.error(t('settingsPage.removeLogoFailed'));
    }
  };

  const handleSectionChange = (section: SettingsSection) => {
    if (activeSection === 'restaurant' && restFormDirty && section !== 'restaurant') {
      if (!window.confirm(t('settingsPage.discardRestaurantConfirm'))) {
        return;
      }
      // Revert form to saved values
      if (restaurant) {
        setRestForm({
          name: restaurant.name ?? '',
          address: restaurant.address ?? '',
          phone: restaurant.phone ?? '',
          gstin: restaurant.gstin ?? '',
          fssai: restaurant.fssai ?? '',
          logoPath: restaurant.logoPath ?? '',
        });
        // restFormDirty will be cleared by the derived-dirty useEffect
      }
    }
    setActiveSection(section);
  };

  const handleToggleSetting = async (key: string) => {
    const current = settings[key];
    const newVal = current === 'true' ? 'false' : 'true';
    await setSetting(key, newVal);
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    await setSetting(key, value);
  };

  const handleTaxDefaultRateChange = async (value: string) => {
    setStoredTaxConfigForRegion(taxRegion, { default_tax_rate: value });
    await setSetting('default_tax_rate', value);
  };

  const handleTaxInclusiveToggleForRegion = async () => {
    const next = settings.tax_inclusive === 'true' ? 'false' : 'true';
    setStoredTaxConfigForRegion(taxRegion, { tax_inclusive: next });
    await setSetting('tax_inclusive', next);
  };

  const refreshDaySession = useDaySessionStore((s) => s.fetch);

  const handleOpenSession = async () => {
    const cash = Math.round(parseFloat(openingCash || '0') * 100);
    try {
      await openDaySession(cash, 1, sessionNotes || undefined);
      await refreshDaySession();
      setOpeningCash('');
      setSessionNotes('');
      showSaveConfirmation();
    } catch {
      // Error set in hook
    }
  };

  const handleCloseSession = async () => {
    const cash = Math.round(parseFloat(closingCash || '0') * 100);
    try {
      const today = new Date().toISOString().split('T')[0];
      const summary = await ipc<any>(window.electronAPI.reports.dayEndSummary({
        startDate: today,
        endDate: today,
      }));
      setDayEndSummary({ ...summary, closingCash: cash });

      await closeDaySession(cash, 1, sessionNotes || undefined);
      await refreshDaySession();
      setClosingCash('');
      setSessionNotes('');
      setShowDayEndSummary(true);
    } catch {
      // Error set in hook
    }
  };

  const renderRestaurantProfile = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('settingsPage.restaurantProfile')}</h2>
        <p className="text-sm text-gray-500">{t('settingsPage.restaurantProfileDesc')}</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.restaurantName')}</label>
          <input
            type="text"
            value={restForm.name}
            onChange={(e) => setRestForm({ ...restForm, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
            placeholder={t('settingsPage.restaurantNamePh')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.address')}</label>
          <textarea
            value={restForm.address}
            onChange={(e) => setRestForm({ ...restForm, address: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none resize-none"
            rows={3}
            placeholder={t('settingsPage.addressPh')}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.phone')}</label>
            <input
              type="tel"
              value={restForm.phone}
              onChange={(e) => setRestForm({ ...restForm, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
              placeholder={t('settingsPage.phonePh')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{taxTerms.businessTaxId}</label>
            <input
              type="text"
              value={restForm.gstin}
              onChange={(e) => setRestForm({ ...restForm, gstin: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
              placeholder="22AAAAA0000A1Z5"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{taxTerms.foodLicense}</label>
          <input
            type="text"
            value={restForm.fssai}
            onChange={(e) => setRestForm({ ...restForm, fssai: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
            placeholder={taxTerms.foodLicense}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.logo')}</label>
          <div className="flex items-center gap-3">
            {logoPreviewUrl ? (
              <div className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                <img
                  src={logoPreviewUrl}
                  alt={t('settingsPage.logoAlt')}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                <Building2 size={24} className="text-gray-400" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={logoInputRef}
                className="hidden"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={handleLogoFileChange}
              />
              <Button
                variant="secondary"
                icon={<Upload size={16} />}
                size="sm"
                onClick={() => logoInputRef.current?.click()}
              >
                {t('settingsPage.uploadLogo')}
              </Button>
              {logoPreviewUrl && (
                <Button
                  variant="secondary"
                  icon={<Trash2 size={16} />}
                  size="sm"
                  onClick={handleRemoveLogo}
                >
                  {t('common.delete')}
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">{t('settingsPage.logoHint')}</p>
        </div>
      </div>

      <Button onClick={handleSaveRestaurant} loading={saving} icon={<Save size={16} />}>
        {t('settingsPage.saveProfile')}
      </Button>
    </div>
  );

  const renderTaxConfig = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{taxTerms.settingsTaxTitle}</h2>
        <p className="text-sm text-gray-500">{taxTerms.settingsTaxSubtitle}</p>
        <p className="text-xs text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mt-2">
          {t('taxLocale.activeProfile')}: {t(`taxLocale.regionNames.${taxRegion}`)}
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.taxDefaultRate')}</label>
          <input
            type="number"
            value={settings.default_tax_rate ?? taxLocalePreset.defaultRate}
            onChange={(e) => void handleTaxDefaultRateChange(e.target.value)}
            className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
            min="0"
            max={taxLocalePreset.maxRate}
            step="0.5"
          />
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-700">{t('settingsPage.taxInclusiveTitle')}</p>
            <p className="text-xs text-gray-500">{t('settingsPage.taxInclusiveDesc')}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleTaxInclusiveToggleForRegion()}
            className="flex-shrink-0"
          >
            {settings.tax_inclusive === 'true' ? (
              <ToggleRight size={32} className="text-blue-600" />
            ) : (
              <ToggleLeft size={32} className="text-gray-400" />
            )}
          </button>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{taxTerms.slabsSectionTitle}</h3>
          <div
            className={`grid gap-3 ${
              taxLocalePreset.slabs.length <= 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'
            }`}
          >
            {taxLocalePreset.slabs.map((rate) => (
              <div key={rate} className="p-3 rounded-lg bg-gray-50 text-center">
                <p className="text-lg font-bold text-gray-900">{rate}%</p>
                <p className="text-xs text-gray-500 mt-1">{formatSlabSplitLine(rate, taxTerms)}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">{taxTerms.splitExplanation}</p>
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3">
            {t(taxLocalePreset.footnoteKey)}
          </p>
        </div>
      </div>
    </div>
  );

  const [printerList, setPrinterList] = useState<{ name: string; displayName: string; isDefault: boolean }[]>([]);
  const [printersLoading, setPrintersLoading] = useState(false);
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

  // Auto-load printer list when the printer section is active
  useEffect(() => {
    if (activeSection === 'printer' && printerList.length === 0) {
      loadPrinters();
    }
  }, [activeSection]);

  const renderReceiptFieldEditor = (kind: 'bill' | 'kot') => {
    const defs: ReceiptFieldDef[] = kind === 'bill' ? BILL_FIELD_DEFS : KOT_FIELD_DEFS;
    const key = kind === 'bill' ? 'bill_layout' : 'kot_layout';
    const layout: ReceiptLayout = mergeLayout(settings[key], defs);
    const widthMap: Record<string, number> = { '58mm': 32, '72mm': 38, '76mm': 40, '80mm': 42, '112mm': 56 };
    const W = widthMap[settings.paper_width ?? '80mm'] ?? 42;

    const persist = (next: ReceiptLayout) => { void setSetting(key, JSON.stringify(next)); };
    const toggleVisible = (id: string) => persist(layout.map((c) => {
      if (c.id !== id) return c;
      if (getFieldDef(defs, id)?.core) return c;
      return { ...c, visible: !c.visible };
    }));
    const rename = (id: string, label: string) => persist(layout.map((c) => (
      c.id === id ? { ...c, label: label.trim() ? label : undefined } : c
    )));
    const reorder = (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= layout.length || to >= layout.length) return;
      const next = [...layout];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      persist(next);
    };

    const billPreviewLabels: Record<string, string> = {
      phone: t('bill.tel'), gstin: taxTerms.businessTaxId, fssai: taxTerms.foodLicense,
      orderNo: t('bill.orderNo'), date: t('bill.date'), type: t('bill.type'), table: t('bill.table'), cashier: t('bill.cashier'),
      item: t('bill.item'), qty: t('bill.qty'), amount: t('bill.amount'),
      subtotal: t('bill.subtotal'), discount: t('bill.discount'), roundOff: t('bill.roundOff'), grandTotal: t('bill.grandTotal'),
      coinsRedeemed: t('bill.coinsRedeemed'), coinsEarned: t('bill.coinsEarned'), thankYou: t('bill.thankYou'),
    };
    const kotPreviewLabels: Record<string, string> = {
      title: 'KOT', kotCount: 'KOT Count', date: 'Date', totalItems: 'Total Items', item: 'Item', qty: 'Qty',
    };

    const previewText = kind === 'bill'
      ? renderBillText(buildSampleBillModel(billPreviewLabels, (settings.bill_item_style ?? 'name_qty') as ReceiptItemStyle), layout, W, false)
      : renderKotText(buildSampleKotModel(kotPreviewLabels, (settings.kot_item_style ?? 'name_qty') as ReceiptItemStyle), layout, W);

    // The logo prints as an image (not text), so show a mock placeholder in the
    // preview when the logo field is toggled on so the layout is obvious.
    const showLogoPreview = kind === 'bill' && isFieldVisible(layout, 'logo');

    return (
      <div className="border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">{t(`settingsPage.receiptFields.${kind}Title`)}</p>
          <button onClick={() => persist(defaultLayout(defs))} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <RotateCcw size={12} /> {t('settingsPage.receiptFields.reset')}
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-1">
            {layout.map((cfg, i) => {
              const def = getFieldDef(defs, cfg.id);
              if (!def) return null;
              const draggable = isReorderable(def);
              const name = t(`settingsPage.receiptFields.${kind}.${cfg.id}`);
              const isDragging = dragField?.kind === kind && dragField.index === i;
              const isDragOver = dragOverField?.kind === kind && dragOverField.index === i && !isDragging;
              return (
                <div
                  key={cfg.id}
                  draggable={draggable}
                  onDragStart={(e) => { if (!draggable) return; setDragField({ kind, index: i }); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragEnter={() => { if (dragField?.kind === kind) setDragOverField({ kind, index: i }); }}
                  onDragOver={(e) => { if (dragField?.kind === kind) e.preventDefault(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragField?.kind === kind) reorder(dragField.index, i);
                    setDragField(null);
                    setDragOverField(null);
                  }}
                  onDragEnd={() => { setDragField(null); setDragOverField(null); }}
                  className={`flex items-center gap-2 bg-gray-50 rounded px-2 py-1.5 border ${
                    isDragOver ? 'border-blue-400 border-dashed' : 'border-transparent'
                  } ${isDragging ? 'opacity-40' : ''}`}
                >
                  <span className={draggable ? 'text-gray-400 cursor-grab active:cursor-grabbing' : 'text-gray-200 cursor-not-allowed'}>
                    <GripVertical size={14} />
                  </span>
                  <button
                    onClick={() => toggleVisible(cfg.id)}
                    disabled={!!def.core}
                    title={def.core ? t('settingsPage.receiptFields.alwaysOn') : ''}
                    className={`shrink-0 ${def.core ? 'opacity-30 cursor-not-allowed' : cfg.visible ? 'text-blue-600' : 'text-gray-400'}`}
                  >
                    {cfg.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <span className={`text-xs flex-1 truncate ${cfg.visible ? 'text-gray-700' : 'text-gray-400 line-through'}`}>{name}</span>
                  {def.renamable && (
                    <ReceiptFieldLabelInput
                      value={cfg.label ?? ''}
                      placeholder={t('settingsPage.receiptFields.labelPlaceholder')}
                      onCommit={(label) => rename(cfg.id, label)}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{t('settingsPage.receiptFields.preview')}</p>
            <div className="bg-gray-100 rounded overflow-x-auto flex justify-center min-h-[320px]">
              <div className="inline-flex flex-col items-center px-3 py-3">
                {showLogoPreview && (
                  <div className="mb-2 flex flex-col items-center text-gray-400">
                    <div className="w-12 h-12 rounded-md border border-dashed border-gray-300 bg-white flex items-center justify-center">
                      <ImageIcon size={20} />
                    </div>
                    <span className="text-[8px] uppercase tracking-wider mt-0.5">{t('settingsPage.receiptFields.bill.logo', { defaultValue: 'Logo' })}</span>
                  </div>
                )}
                <pre className="text-xs font-mono text-gray-700 leading-relaxed whitespace-pre inline-block">{previewText}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Live, always-visible receipt preview that reflects the selected paper width
  // and font size so the user can visually figure out the print layout. Font
  // scaling is forced for the preview so its effect is visible in every print
  // mode (not only raster).
  const renderLivePreview = () => {
    const paperWidth = settings.paper_width ?? '80mm';
    const printMode = settings.print_mode ?? 'thermal';
    const billLayout = mergeLayout(settings.bill_layout, BILL_FIELD_DEFS);
    const kotLayout = mergeLayout(settings.kot_layout, KOT_FIELD_DEFS);

    const billW = computePrintLineWidth(paperWidth, printMode, settings.bill_font_size, true);
    const kotW = computePrintLineWidth(paperWidth, printMode, settings.kot_font_size, true);

    const billLabels: Record<string, string> = {
      phone: t('bill.tel'), gstin: taxTerms.businessTaxId, fssai: taxTerms.foodLicense,
      orderNo: t('bill.orderNo'), date: t('bill.date'), type: t('bill.type'), table: t('bill.table'), cashier: t('bill.cashier'),
      item: t('bill.item'), qty: t('bill.qty'), amount: t('bill.amount'),
      subtotal: t('bill.subtotal'), discount: t('bill.discount'), roundOff: t('bill.roundOff'), grandTotal: t('bill.grandTotal'),
      coinsRedeemed: t('bill.coinsRedeemed'), coinsEarned: t('bill.coinsEarned'), thankYou: t('bill.thankYou'),
    };
    const kotLabels: Record<string, string> = {
      title: 'KOT', kotCount: 'KOT Count', date: 'Date', totalItems: 'Total Items', item: 'Item', qty: 'Qty',
    };

    const billText = renderBillText(
      buildSampleBillModel(billLabels, (settings.bill_item_style ?? 'name_qty') as ReceiptItemStyle),
      billLayout, billW, true,
    );
    const kotText = renderKotText(
      buildSampleKotModel(kotLabels, (settings.kot_item_style ?? 'name_qty') as ReceiptItemStyle),
      kotLayout, kotW,
    );

    // Base monospace cell at 1x; scales with the selected font size.
    const billFontPx = 7 * fontScale(settings.bill_font_size);
    const kotFontPx = 7 * fontScale(settings.kot_font_size);

    const paperCard = (text: string, fontPx: number, title: string) => (
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5">{title}</p>
        <div className="bg-gray-100 rounded-lg p-3 overflow-x-auto flex justify-center">
          <pre
            className="bg-white text-gray-800 font-mono shadow-sm rounded-sm px-2 py-3 whitespace-pre leading-tight inline-block"
            style={{ fontSize: `${fontPx}px` }}
          >
            {text}
          </pre>
        </div>
      </div>
    );

    return (
      <div className="lg:col-span-2 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-gray-700">{t('settingsPage.livePreviewTitle', { defaultValue: 'Live Preview' })}</p>
            <p className="text-xs text-gray-500">
              {t('settingsPage.livePreviewDesc', {
                defaultValue: 'Reflects the selected paper width and font size. {{cols}} characters per line.',
                cols: billW,
              })}
            </p>
          </div>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-3 py-1">
            {paperWidth} · {printMode}
          </span>
        </div>
        <div className="flex flex-col lg:flex-row gap-4">
          {paperCard(billText, billFontPx, t('settingsPage.receiptFields.billTitle'))}
          {paperCard(kotText, kotFontPx, t('settingsPage.receiptFields.kotTitle'))}
        </div>
      </div>
    );
  };

  const renderPrinterSetup = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('settingsPage.printerSetup')}</h2>
        <p className="text-sm text-gray-500">{t('settingsPage.printerSetupDesc')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5 items-start">
        {/* Print Mode Toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.printMode')}</label>
          <div className="flex gap-2">
            {([
              { key: 'thermal', label: t('settingsPage.printModeThermal'), desc: t('settingsPage.printModeThermalDesc') },
              { key: 'html', label: t('settingsPage.printModeHtml'), desc: t('settingsPage.printModeHtmlDesc') },
              { key: 'raster', label: t('settingsPage.printModeRaster'), desc: t('settingsPage.printModeRasterDesc') },
            ] as const).map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => handleUpdateSetting('print_mode', key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  (settings.print_mode ?? 'thermal') === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
                <span className={`block text-[10px] font-normal ${(settings.print_mode ?? 'thermal') === key ? 'opacity-80' : 'opacity-60'}`}>{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Refresh printer list */}
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <p className="text-sm text-blue-700">
            {printerList.length > 0
              ? t('settingsPage.printersFound', { count: printerList.length })
              : t('settingsPage.printersLoadHint')}
          </p>
          <Button
            variant="secondary"
            size="sm"
            icon={printersLoading ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            onClick={loadPrinters}
            loading={printersLoading}
          >
            {printerList.length > 0 ? t('settingsPage.refreshPrinters') : t('settingsPage.loadPrinters')}
          </Button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.billPrinter')}</label>
          <select
            value={settings.printer_bill ?? ''}
            onChange={(e) => handleUpdateSetting('printer_bill', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none bg-white"
          >
            <option value="">{t('settingsPage.printerNoneOption')}</option>
            {printerList.map((p) => (
              <option key={p.name} value={p.name}>
                {p.displayName}{p.isDefault ? t('settingsPage.printerDefaultSuffix') : ''}
              </option>
            ))}
          </select>
          {settings.printer_bill && !printerList.find((p) => p.name === settings.printer_bill) && printerList.length > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              {t('settingsPage.printerNotFoundWarn', { name: settings.printer_bill })}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.kotPrinter')}</label>
          <select
            value={settings.printer_kot ?? ''}
            onChange={(e) => handleUpdateSetting('printer_kot', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none bg-white"
          >
            <option value="">{t('settingsPage.printerNoneOption')}</option>
            {printerList.map((p) => (
              <option key={p.name} value={p.name}>
                {p.displayName}{p.isDefault ? t('settingsPage.printerDefaultSuffix') : ''}
              </option>
            ))}
          </select>
          {settings.printer_kot && !printerList.find((p) => p.name === settings.printer_kot) && printerList.length > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              {t('settingsPage.printerNotFoundWarn', { name: settings.printer_kot })}
            </p>
          )}
        </div>

        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.paperWidth')}</label>
          <div className="flex gap-2">
            {['58mm', '72mm', '76mm', '80mm', '112mm'].map((width) => (
              <button
                key={width}
                onClick={() => handleUpdateSetting('paper_width', width)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  (settings.paper_width ?? '80mm') === width
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {width}
              </button>
            ))}
          </div>
        </div>

        {/* KOT Item Style */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.kotItemStyle')}</label>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
            {(['name_qty', 'qty_x_name', 'qty_name', 'sno_name_qty'] as const).map((style) => {
              const selected = (settings.kot_item_style ?? 'name_qty') === style;
              const W = 28;
              const itemLines: Record<string, string[]> = {
                name_qty: ['Margarita Pizza'.padEnd(W - 3) + '  3', '  + Extra Cheese'],
                qty_x_name: ['3 x Margarita Pizza', '  + Extra Cheese'],
                qty_name: ['  3  Margarita Pizza', '  + Extra Cheese'],
                sno_name_qty: ['1. Margarita Pizza'.padEnd(W - 3) + '  3', '  + Extra Cheese'],
              };
              const header = (style === 'name_qty' || style === 'sno_name_qty')
                ? t('settingsPage.preview.item').padEnd(W - 3) + t('settingsPage.preview.qty')
                : t('settingsPage.preview.items');
              const kotReceipt = [
                '         ' + t('settingsPage.preview.kot'),
                '----------------------------',
                'Table: T1',
                'Date: 17/05/26, 12:00 PM',
                '----------------------------',
                header,
                '----------------------------',
                ...itemLines[style],
                'Paneer Wrap'.padEnd(W - 3) + (style === 'qty_x_name' ? '' : style === 'qty_name' ? '' : '  2'),
                style === 'qty_x_name' ? '2 x Paneer Wrap' : style === 'qty_name' ? '  2  Paneer Wrap' : '',
                '----------------------------',
                t('settingsPage.preview.totalItems') + ': 5',
              ].filter((l) => l !== '');
              return (
                <button
                  key={style}
                  onClick={() => handleUpdateSetting('kot_item_style', style)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    selected
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-xs font-medium text-gray-600 mb-1">{t(`settingsPage.style_${style}`)}</p>
                  <div className="bg-gray-100 rounded overflow-hidden flex justify-center">
                    <pre className="text-[9px] font-mono text-gray-600 px-2 py-1 leading-tight inline-block">
                      {kotReceipt.join('\n')}
                    </pre>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* KOT Count Mode */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.kotCountMode')}</label>
          <p className="text-xs text-gray-500 mb-2">{t('settingsPage.kotCountModeDesc')}</p>
          <div className="flex gap-2">
            {(['daily', 'total'] as const).map((mode) => {
              const selected = (settings.kot_count_mode ?? 'daily') === mode;
              return (
                <button
                  key={mode}
                  onClick={() => handleUpdateSetting('kot_count_mode', mode)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    selected
                      ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {t(`settingsPage.kotCountMode_${mode}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bill Item Style */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.billItemStyle')}</label>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
            {(['name_qty', 'qty_x_name', 'qty_name', 'sno_name_qty'] as const).map((style) => {
              const selected = (settings.bill_item_style ?? 'name_qty') === style;
              const W = 30;
              const amt = '    990.00';
              const amt2 = '    330.00';
              const buildBillItem = (idx: number, name: string, qty: number, total: string): string[] => {
                switch (style) {
                  case 'qty_x_name': {
                    const line = `${qty} x ${name}`;
                    return line.length > W - 11
                      ? [line, ''.padEnd(W - total.trim().length) + total.trim()]
                      : [`${line}${' '.repeat(Math.max(1, W - line.length - total.length))}${total}`];
                  }
                  case 'qty_name': {
                    const line = `${String(qty).padStart(3)}  ${name}`;
                    return line.length > W - 11
                      ? [line, ''.padEnd(W - total.trim().length) + total.trim()]
                      : [`${line}${' '.repeat(Math.max(1, W - line.length - total.length))}${total}`];
                  }
                  case 'sno_name_qty': {
                    const snoName = `${idx + 1}. ${name}`;
                    const qtyStr = String(qty).padStart(3);
                    return [`${snoName}${' '.repeat(Math.max(1, W - snoName.length - qtyStr.length - total.length))}${qtyStr}${total}`];
                  }
                  case 'name_qty':
                  default: {
                    const qtyStr = String(qty).padStart(3);
                    return [`${name}${' '.repeat(Math.max(1, W - name.length - qtyStr.length - total.length))}${qtyStr}${total}`];
                  }
                }
              };
              const colHeader = (style === 'qty_x_name' || style === 'qty_name')
                ? `${t('settingsPage.preview.item')}${' '.repeat(Math.max(1, W - 4 - 6))}${t('settingsPage.preview.amount')}`
                : `${t('settingsPage.preview.item')}${' '.repeat(Math.max(1, W - 4 - 3 - 6))}${t('settingsPage.preview.qty')}${' '.repeat(1)}${t('settingsPage.preview.amount')}`;
              const billReceipt = [
                '       MY RESTAURANT',
                '123 Main St, City',
                '==============================',
                'Order    001',
                'Date     17/05/26 12:00 PM',
                'Type     Dine In',
                '------------------------------',
                colHeader,
                '------------------------------',
                ...buildBillItem(0, 'Margarita Pizza', 3, amt),
                ...buildBillItem(1, 'Paneer Wrap', 1, amt2),
                '------------------------------',
                `${t('settingsPage.preview.subtotal')}${''.padStart(W - 8 - 9)}  1,320.00`,
                `${t('settingsPage.preview.grandTotal')}${''.padStart(W - 11 - 9)}  1,320.00`,
                '==============================',
                '      ' + t('settingsPage.preview.thankYou'),
              ];
              return (
                <button
                  key={style}
                  onClick={() => handleUpdateSetting('bill_item_style', style)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    selected
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-xs font-medium text-gray-600 mb-1">{t(`settingsPage.style_${style}`)}</p>
                  <div className="bg-gray-100 rounded overflow-hidden flex justify-center">
                    <pre className="text-[9px] font-mono text-gray-600 px-2 py-1 leading-tight inline-block">
                      {billReceipt.join('\n')}
                    </pre>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* KOT Font Size */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.kotFontSize')}</label>
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'regular', label: t('settingsPage.fontSize.regular'), desc: '1.5x' },
              { key: 'small', label: t('settingsPage.fontSize.small'), desc: '1x' },
              { key: 'medium', label: t('settingsPage.fontSize.medium'), desc: t('settingsPage.fontSize.twoXH') },
              { key: 'large', label: t('settingsPage.fontSize.large'), desc: '2x' },
            ]).map(({ key, label, desc }) => {
              const selected = (settings.kot_font_size ?? 'medium') === key;
              return (
                <button
                  key={key}
                  onClick={() => handleUpdateSetting('kot_font_size', key)}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    selected
                      ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {label}
                  <span className="block text-[10px] font-normal opacity-60">{desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bill Font Size */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.billFontSize')}</label>
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'regular', label: t('settingsPage.fontSize.regular'), desc: '1.5x' },
              { key: 'small', label: t('settingsPage.fontSize.small'), desc: '1x' },
              { key: 'medium', label: t('settingsPage.fontSize.medium'), desc: t('settingsPage.fontSize.twoXH') },
              { key: 'large', label: t('settingsPage.fontSize.large'), desc: '2x' },
            ]).map(({ key, label, desc }) => {
              const selected = (settings.bill_font_size ?? 'medium') === key;
              return (
                <button
                  key={key}
                  onClick={() => handleUpdateSetting('bill_font_size', key)}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    selected
                      ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {label}
                  <span className="block text-[10px] font-normal opacity-60">{desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live preview — reflects paper width + font size */}
        {renderLivePreview()}

        {/* Receipt Fields editor (Raster mode only) */}
        {(settings.print_mode ?? 'thermal') === 'raster' && (
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.receiptFields.title')}</label>
            <p className="text-xs text-gray-500 mb-2">{t('settingsPage.receiptFields.hint')}</p>
            <div className="space-y-3">
              {renderReceiptFieldEditor('bill')}
              {renderReceiptFieldEditor('kot')}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg lg:col-span-2">
          <div>
            <p className="text-sm font-medium text-gray-700">{t('settingsPage.autoPrintBillTitle')}</p>
            <p className="text-xs text-gray-500">{t('settingsPage.autoPrintBillDesc')}</p>
          </div>
          <button onClick={() => handleToggleSetting('auto_print_bill')}>
            {settings.auto_print_bill === 'true' ? (
              <ToggleRight size={32} className="text-blue-600" />
            ) : (
              <ToggleLeft size={32} className="text-gray-400" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">{t('settingsPage.centerBillPrintTitle')}</p>
            <p className="text-xs text-gray-500">{t('settingsPage.centerBillPrintDesc')}</p>
          </div>
          <button onClick={() => handleToggleSetting('bill_center_print')}>
            {settings.bill_center_print === 'true' ? (
              <ToggleRight size={32} className="text-blue-600" />
            ) : (
              <ToggleLeft size={32} className="text-gray-400" />
            )}
          </button>
        </div>

        <div className="flex gap-2 lg:col-span-2">
          <Button
            variant="secondary"
            icon={<TestTube size={16} />}
            onClick={async () => {
              try {
                await ipc(window.electronAPI.kot.testPrint());
                showSaveConfirmation();
              } catch {
                // Print dialog will appear even on error
              }
            }}
          >
            {t('settingsPage.testKotPrint')}
          </Button>
          <Button
            variant="secondary"
            icon={<TestTube size={16} />}
            onClick={async () => {
              try {
                await ipc(window.electronAPI.bill.testPrint());
                showSaveConfirmation();
              } catch {
                // Print dialog will appear even on error
              }
            }}
          >
            {t('settingsPage.testBillPrint')}
          </Button>
        </div>
      </div>
    </div>
  );

  const renderBillingSettings = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('settingsPage.billingSettings')}</h2>
        <p className="text-sm text-gray-500">{t('settingsPage.billingSettingsDesc')}</p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.billPrefix')}</label>
            <input
              type="text"
              value={settings.bill_prefix ?? 'ORD-'}
              onChange={(e) => handleUpdateSetting('bill_prefix', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
              placeholder="ORD-"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.kotPrefix')}</label>
            <input
              type="text"
              value={settings.kot_prefix ?? 'KOT-'}
              onChange={(e) => handleUpdateSetting('kot_prefix', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
              placeholder="KOT-"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.defaultOrderType')}</label>
          <select
            value={settings.default_order_type ?? 'dine_in'}
            onChange={(e) => handleUpdateSetting('default_order_type', e.target.value)}
            className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none bg-white"
          >
            <option value="dine_in">{t('settingsPage.orderTypeDineIn')}</option>
            <option value="takeaway">{t('settingsPage.orderTypeTakeaway')}</option>
            <option value="delivery">{t('settingsPage.orderTypeDelivery')}</option>
          </select>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-700">{t('settingsPage.enableTipsTitle')}</p>
            <p className="text-xs text-gray-500">{t('settingsPage.enableTipsDesc')}</p>
          </div>
          <button onClick={() => handleToggleSetting('enable_tips')}>
            {settings.enable_tips === 'true' ? (
              <ToggleRight size={32} className="text-blue-600" />
            ) : (
              <ToggleLeft size={32} className="text-gray-400" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-700">{t('settingsPage.roundOffTitle')}</p>
            <p className="text-xs text-gray-500">{t('settingsPage.roundOffDesc')}</p>
          </div>
          <button onClick={() => handleToggleSetting('round_off')}>
            {settings.round_off === 'true' ? (
              <ToggleRight size={32} className="text-blue-600" />
            ) : (
              <ToggleLeft size={32} className="text-gray-400" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-700">{t('settingsPage.showPricesTitle')}</p>
            <p className="text-xs text-gray-500">{t('settingsPage.showPricesDesc')}</p>
          </div>
          <button onClick={() => handleToggleSetting('show_menu_prices')}>
            {(settings.show_menu_prices ?? 'true') === 'true' ? (
              <ToggleRight size={32} className="text-blue-600" />
            ) : (
              <ToggleLeft size={32} className="text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {WHATSAPP_FEATURE_ENABLED && (
        <>
          {/* WhatsApp Bill */}
          <div className="mt-8 border-t border-gray-200 pt-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('settings.whatsappTitle')}</h3>
              <p className="text-sm text-gray-500">{t('settings.whatsappDesc')}</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700">{t('settings.whatsappEnabled')}</p>
                  <p className="text-xs text-gray-500">{t('settings.whatsappEnabledDesc')}</p>
                </div>
                <button onClick={() => handleToggleSetting('whatsapp_enabled')}>
                  {settings.whatsapp_enabled === 'true' ? (
                    <ToggleRight size={32} className="text-green-600" />
                  ) : (
                    <ToggleLeft size={32} className="text-gray-400" />
                  )}
                </button>
              </div>

              {settings.whatsapp_enabled === 'true' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.chatmitraApiKey')}</label>
                  <input
                    type="password"
                    value={settings.chatmitra_api_key ?? ''}
                    onChange={(e) => handleUpdateSetting('chatmitra_api_key', e.target.value)}
                    placeholder={t('settings.chatmitraApiKeyPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">{t('settings.chatmitraApiKeyHint')}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [backupMsgIsError, setBackupMsgIsError] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveMsg, setArchiveMsg] = useState('');
  const [archiveMsgIsError, setArchiveMsgIsError] = useState(false);

  const handleArchiveOldOrders = async () => {
    setArchiveLoading(true);
    setArchiveMsg('');
    setArchiveMsgIsError(false);
    try {
      const result = await ipc<{
        savedTo: string;
        ordersArchived: number;
        ordersDeleted: number;
      }>(window.electronAPI.backup.archiveOldOrders(730));
      if (result.ordersArchived === 0) {
        setArchiveMsg(
          t(
            'settingsPage.archiveNoOrders',
            'No orders older than 2 years to archive.',
          ),
        );
      } else if (result.ordersDeleted === 0) {
        setArchiveMsg(
          t('settingsPage.archiveSavedOnly', {
            path: result.savedTo,
            count: result.ordersArchived,
            defaultValue: 'Saved {{count}} order(s) to {{path}}. Deletion was cancelled.',
          }),
        );
      } else {
        setArchiveMsg(
          t('settingsPage.archiveDone', {
            path: result.savedTo,
            archived: result.ordersArchived,
            deleted: result.ordersDeleted,
            defaultValue:
              'Archived {{archived}} order(s) to {{path}} and deleted {{deleted}} from the database.',
          }),
        );
      }
    } catch (err: any) {
      if (err?.message !== 'Cancelled') {
        setArchiveMsgIsError(true);
        setArchiveMsg(err?.message ?? t('settingsPage.archiveFailed'));
      }
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    setBackupMsg('');
    setBackupMsgIsError(false);
    try {
      const result = await ipc<{ savedTo: string }>(window.electronAPI.backup.create());
      await fetchSettings(SETTING_KEYS);
      setBackupMsgIsError(false);
      setBackupMsg(t('settingsPage.backupSavedTo', { path: result.savedTo }));
    } catch (err: any) {
      if (err?.message !== 'Cancelled') {
        setBackupMsgIsError(true);
        setBackupMsg(t('settingsPage.backupError', { message: err?.message ?? t('settingsPage.backupFailed') }));
      }
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = async () => {
    setRestoreLoading(true);
    try {
      await ipc(window.electronAPI.backup.restore());
    } catch (err: any) {
      if (err?.message !== 'Cancelled') {
        setBackupMsgIsError(true);
        setBackupMsg(t('settingsPage.backupError', { message: err?.message ?? t('settingsPage.restoreFailed') }));
      }
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleReset = async () => {
    setResetLoading(true);
    try {
      await ipc(window.electronAPI.backup.reset());
    } catch (err: any) {
      if (err?.message !== 'Cancelled') {
        setBackupMsgIsError(true);
        setBackupMsg(t('settingsPage.backupError', { message: err?.message ?? t('settingsPage.resetFailed') }));
      }
    } finally {
      setResetLoading(false);
    }
  };



  // ── Cloud Dashboard (remote owner view) state ──
  interface CloudStatus {
    configured: boolean;
    connected: boolean;
    email: string | null;
    lastSyncAt: string | null;
    lastError: string | null;
  }
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>({
    configured: false, connected: false, email: null, lastSyncAt: null, lastError: null,
  });
  const [cloudEmail, setCloudEmail] = useState('');
  const [cloudPassword, setCloudPassword] = useState('');
  const [cloudShowPassword, setCloudShowPassword] = useState(false);
  const [cloudCreateMode, setCloudCreateMode] = useState(false);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudMsg, setCloudMsg] = useState('');
  const [cloudMsgIsError, setCloudMsgIsError] = useState(false);

  useEffect(() => {
    if (activeSection !== 'cloud') return;
    ipc<CloudStatus>(window.electronAPI.cloud.getStatus())
      .then(setCloudStatus)
      .catch(() => {});
  }, [activeSection]);

  // Turn a raw Firebase auth error into a clear message. The error code only
  // survives across IPC inside the message text (e.g. "(auth/weak-password)"),
  // so we extract it from there.
  const friendlyCloudError = (raw: string): string => {
    const code = (raw.match(/\(auth\/[a-z-]+\)/i)?.[0] ?? '').replace(/[()]/g, '');
    const map: Record<string, string> = {
      'auth/weak-password': t('settingsPage.cloudErrWeakPassword', 'Password must be at least 6 characters.'),
      'auth/email-already-in-use': t('settingsPage.cloudErrEmailInUse', 'An account already exists for this email. Uncheck “Create a new account” and just connect.'),
      'auth/invalid-email': t('settingsPage.cloudErrInvalidEmail', 'Please enter a valid email address.'),
      'auth/invalid-credential': t('settingsPage.cloudErrBadCreds', 'Incorrect email or password.'),
      'auth/wrong-password': t('settingsPage.cloudErrBadCreds', 'Incorrect email or password.'),
      'auth/user-not-found': t('settingsPage.cloudErrNoAccount', 'No account found. Check “Create a new account” for first-time setup.'),
      'auth/network-request-failed': t('settingsPage.cloudErrNetwork', 'Network error. Check your internet connection.'),
      'auth/too-many-requests': t('settingsPage.cloudErrTooMany', 'Too many attempts. Please wait a moment and try again.'),
      'auth/operation-not-allowed': t('settingsPage.cloudErrNotAllowed', 'Email/password sign-in is not enabled for this project.'),
    };
    return map[code] ?? raw ?? t('settingsPage.cloudConnectFailed', 'Connection failed.');
  };

  const handleCloudConnect = async () => {
    if (!cloudEmail.trim() || !cloudPassword) {
      setCloudMsgIsError(true);
      setCloudMsg(t('settingsPage.cloudEmailPasswordRequired', 'Enter an email and password.'));
      return;
    }
    if (cloudPassword.length < 6) {
      setCloudMsgIsError(true);
      setCloudMsg(t('settingsPage.cloudErrWeakPassword', 'Password must be at least 6 characters.'));
      return;
    }
    setCloudLoading(true);
    setCloudMsg('');
    setCloudMsgIsError(false);
    try {
      const status = await ipc<CloudStatus>(
        window.electronAPI.cloud.connect(cloudEmail.trim(), cloudPassword, { create: cloudCreateMode })
      );
      setCloudStatus(status);
      setCloudPassword('');
      setCloudMsgIsError(false);
      setCloudMsg(t('settingsPage.cloudConnected', 'Connected. Your dashboard will update automatically.'));
    } catch (err: any) {
      setCloudMsgIsError(true);
      setCloudMsg(friendlyCloudError(err?.message ?? ''));
    } finally {
      setCloudLoading(false);
    }
  };

  const handleCloudDisconnect = async () => {
    if (!confirm(t('settingsPage.cloudDisconnectConfirm', 'Stop syncing to the cloud dashboard on this device?'))) return;
    try {
      await ipc(window.electronAPI.cloud.disconnect());
    } catch { /* ignore */ }
    setCloudStatus({ configured: cloudStatus.configured, connected: false, email: null, lastSyncAt: null, lastError: null });
    setCloudMsg('');
  };

  const handleCloudSyncNow = async () => {
    setCloudSyncing(true);
    setCloudMsg('');
    setCloudMsgIsError(false);
    try {
      const status = await ipc<CloudStatus>(window.electronAPI.cloud.syncNow());
      setCloudStatus(status);
      setCloudMsgIsError(false);
      setCloudMsg(t('settingsPage.cloudSyncSuccess', 'Dashboard synced.'));
    } catch (err: any) {
      setCloudMsgIsError(true);
      setCloudMsg(err?.message ?? t('settingsPage.cloudSyncFailed', 'Sync failed.'));
    } finally {
      setCloudSyncing(false);
    }
  };

  const renderCloud = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          {t('settingsPage.cloudTitle', 'Cloud Dashboard')}
        </h2>
        <p className="text-sm text-gray-500">
          {t('settingsPage.cloudDesc', "Sign in to push a live business summary to the cloud so you can watch today's sales, cash, and alerts from your phone or another device.")}
        </p>
      </div>

      {!cloudStatus.configured ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            {t('settingsPage.cloudNotConfigured', 'Cloud sync is not configured in this build. Add your Firebase project details and try again.')}
          </p>
        </div>
      ) : !cloudStatus.connected ? (
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('settingsPage.cloudEmail', 'Owner email')}
            </label>
            <input
              type="email"
              value={cloudEmail}
              onChange={(e) => setCloudEmail(e.target.value)}
              placeholder="owner@example.com"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('settingsPage.cloudPassword', 'Password')}
            </label>
            <div className="relative">
              <input
                type={cloudShowPassword ? 'text' : 'password'}
                value={cloudPassword}
                onChange={(e) => setCloudPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setCloudShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {cloudShowPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={cloudCreateMode}
              onChange={(e) => setCloudCreateMode(e.target.checked)}
              className="rounded border-gray-300"
            />
            {t('settingsPage.cloudCreateMode', 'Create a new account (first-time setup)')}
          </label>

          <Button variant="primary" loading={cloudLoading} icon={<Cloud size={16} />} onClick={handleCloudConnect}>
            {cloudCreateMode
              ? t('settingsPage.cloudCreateConnect', 'Create & Connect')
              : t('settingsPage.cloudConnect', 'Connect')}
          </Button>

          {cloudMsg && (
            <p className={`text-xs ${cloudMsgIsError ? 'text-red-500' : 'text-green-600'}`}>{cloudMsg}</p>
          )}
          <p className="text-[11px] text-gray-400 leading-relaxed">
            {t('settingsPage.cloudSecurityNote', 'Use the same email and password to sign in to your remote dashboard. Only summary totals are sent — no customer details leave this device.')}
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-w-md">
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                <Cloud size={16} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {t('settingsPage.cloudConnectedAs', { email: cloudStatus.email, defaultValue: 'Connected as {{email}}' })}
                </p>
                {cloudStatus.lastSyncAt && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Clock size={12} />
                    {t('settingsPage.cloudLastSync', { time: formatDateTime(cloudStatus.lastSyncAt), defaultValue: 'Last synced {{time}}' })}
                  </p>
                )}
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={handleCloudDisconnect}>
              {t('settingsPage.cloudDisconnect', 'Disconnect')}
            </Button>
          </div>

          <Button variant="primary" size="sm" icon={<RefreshCw size={16} />} loading={cloudSyncing} onClick={handleCloudSyncNow}>
            {t('settingsPage.cloudSyncNow', 'Sync now')}
          </Button>

          {cloudStatus.lastError && (
            <p className="text-xs text-red-500">
              {t('settingsPage.cloudLastError', { message: cloudStatus.lastError, defaultValue: 'Last error: {{message}}' })}
            </p>
          )}
          {cloudMsg && (
            <p className={`text-xs ${cloudMsgIsError ? 'text-red-500' : 'text-green-600'}`}>{cloudMsg}</p>
          )}
        </div>
      )}
    </div>
  );

  const renderOffers = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{t('settingsPage.offersHeading')}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{t('settingsPage.offersDesc')}</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => openOfferModal()}>
          {t('settingsPage.addOffer')}
        </Button>
      </div>

      {offers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3 border-2 border-dashed border-gray-200 rounded-xl">
          <Tag size={40} strokeWidth={1.5} />
          <p className="text-sm">{t('settingsPage.offersEmpty')}</p>
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => openOfferModal()}>
            {t('settingsPage.createFirstOffer')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-all
                ${offer.isActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}
            >
              {/* Icon */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                ${offer.type === 'percentage' ? 'bg-green-100' : 'bg-blue-100'}`}>
                <Tag size={18} className={offer.type === 'percentage' ? 'text-green-600' : 'text-blue-600'} />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{offer.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {offer.type === 'percentage'
                    ? t('settingsPage.offerSummaryPercent', { value: offer.value })
                    : t('settingsPage.offerSummaryFlat', { amount: (offer.value / 100).toFixed(0) })}
                  {t('settingsPage.offerSummaryOnOrdersAbove')}
                  <span className="font-medium text-gray-700">{formatCurrency(offer.minOrderAmount)}</span>
                  {offer.maxDiscount ? (
                    <>
                      {t('settingsPage.offerSummaryMax')}
                      <span className="font-medium text-gray-700">{formatCurrency(offer.maxDiscount)}</span>
                    </>
                  ) : null}
                </p>
              </div>

              {/* Active toggle */}
              <button onClick={() => handleToggleOffer(offer)} className="flex-shrink-0">
                {offer.isActive
                  ? <ToggleRight size={28} className="text-green-600" />
                  : <ToggleLeft size={28} className="text-gray-400" />}
              </button>

              {/* Actions */}
              <button onClick={() => openOfferModal(offer)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors flex-shrink-0">
                <Pencil size={16} />
              </button>
              <button onClick={() => handleDeleteOffer(offer.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors flex-shrink-0">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Offer Modal */}
      {offerModal && (
        <Modal
          isOpen
          onClose={() => setOfferModal(null)}
          title={offerModal.mode === 'create' ? t('settingsPage.offerModalAdd') : t('settingsPage.offerModalEdit')}
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setOfferModal(null)}>{t('common.cancel')}</Button>
              <Button
                variant="primary"
                onClick={handleSaveOffer}
                disabled={!offerForm.name.trim() || !offerForm.value || !offerForm.minOrderAmount}
              >
                {offerModal.mode === 'create' ? t('settingsPage.createOffer') : t('settingsPage.saveChanges')}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.offerName')}</label>
              <input
                type="text"
                value={offerForm.name}
                onChange={(e) => setOfferForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('settingsPage.offerNamePh')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.discountType')}</label>
              <div className="flex gap-3">
                {(['percentage', 'flat'] as const).map((offerType) => (
                  <button
                    key={offerType}
                    onClick={() => setOfferForm((f) => ({ ...f, type: offerType }))}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors
                      ${offerForm.type === offerType ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    {offerType === 'percentage' ? t('settingsPage.offerTypePercent') : t('settingsPage.offerTypeFlat')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {offerForm.type === 'percentage' ? t('settingsPage.discountPercentLabel') : t('settingsPage.discountAmountLabel')}
                </label>
                <input
                  type="number"
                  min="0"
                  max={offerForm.type === 'percentage' ? '100' : undefined}
                  value={offerForm.value}
                  onChange={(e) => setOfferForm((f) => ({ ...f, value: e.target.value }))}
                  placeholder={offerForm.type === 'percentage' ? '10' : '50'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.minOrderAmount')}</label>
                <input
                  type="number"
                  min="0"
                  value={offerForm.minOrderAmount}
                  onChange={(e) => setOfferForm((f) => ({ ...f, minOrderAmount: e.target.value }))}
                  placeholder="500"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none"
                />
              </div>
            </div>

            {offerForm.type === 'percentage' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('settingsPage.maxDiscountCap')} <span className="text-gray-400 font-normal">{t('settingsPage.optionalEmDash')}</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={offerForm.maxDiscount}
                  onChange={(e) => setOfferForm((f) => ({ ...f, maxDiscount: e.target.value }))}
                  placeholder={t('settingsPage.maxDiscountPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button onClick={() => setOfferForm((f) => ({ ...f, isActive: !f.isActive }))}>
                {offerForm.isActive
                  ? <ToggleRight size={28} className="text-green-600" />
                  : <ToggleLeft size={28} className="text-gray-400" />}
              </button>
              <span className="text-sm text-gray-700">{t('settingsPage.offerActiveLine')}</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );

  const renderBackup = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('settingsPage.backupRestore')}</h2>
        <p className="text-sm text-gray-500">{t('settingsPage.backupRestoreDesc')}</p>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('settingsPage.manualBackup')}</h3>
          <p className="text-xs text-gray-500 mb-3">{t('settingsPage.manualBackupDesc')}</p>
          <Button
            variant="primary"
            icon={<Download size={16} />}
            loading={backupLoading}
            onClick={handleBackup}
          >
            {t('settingsPage.backupDatabase')}
          </Button>
          {backupMsg && (
            <p className={`mt-2 text-xs ${backupMsgIsError ? 'text-red-500' : 'text-green-600'}`}>
              {backupMsg}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('settingsPage.restoreSection')}</h3>
          <p className="text-xs text-gray-500 mb-3">{t('settingsPage.restoreSectionDesc')}</p>
          <Button
            variant="danger"
            icon={<Upload size={16} />}
            loading={restoreLoading}
            onClick={handleRestore}
          >
            {t('settingsPage.restoreButton')}
          </Button>
        </div>

        <div className="bg-white rounded-lg border border-amber-200 p-5">
          <h3 className="text-sm font-semibold text-amber-800 mb-3">
            {t('settingsPage.archiveOldOrders', 'Archive & Delete Old Orders')}
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            {t('settingsPage.archiveOldOrdersDesc', 'Export completed orders older than 2 years to a JSON file, then permanently delete them from the database. Frees disk space and keeps reports fast. Active and held orders are never deleted.')}
          </p>
          <Button
            variant="secondary"
            icon={<Download size={16} />}
            loading={archiveLoading}
            onClick={handleArchiveOldOrders}
          >
            {t('settingsPage.archiveOldOrdersButton', 'Archive & Delete')}
          </Button>
          {archiveMsg && (
            <p className={`mt-2 text-xs ${archiveMsgIsError ? 'text-red-500' : 'text-green-600'}`}>
              {archiveMsg}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-red-200 p-5">
          <h3 className="text-sm font-semibold text-red-700 mb-3">{t('settingsPage.resetDatabase', 'Reset Database')}</h3>
          <p className="text-xs text-gray-500 mb-3">{t('settingsPage.resetDatabaseDesc', 'Delete all data and restart with a fresh database. This cannot be undone.')}</p>
          <Button
            variant="danger"
            icon={<Trash2 size={16} />}
            loading={resetLoading}
            onClick={handleReset}
          >
            {t('settingsPage.resetDatabaseButton', 'Clean Database')}
          </Button>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-700">{t('settingsPage.autoBackupTitle')}</p>
            <p className="text-xs text-gray-500">{t('settingsPage.autoBackupDesc')}</p>
          </div>
          <button onClick={() => handleToggleSetting('auto_backup')}>
            {settings.auto_backup === 'true' ? (
              <ToggleRight size={32} className="text-blue-600" />
            ) : (
              <ToggleLeft size={32} className="text-gray-400" />
            )}
          </button>
        </div>

        {settings.last_backup && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock size={14} />
            <span>{t('settingsPage.lastBackup', { time: formatDateTime(settings.last_backup) })}</span>
          </div>
        )}
      </div>
    </div>
  );

  const renderDaySession = () => {
    const isOpen = !!currentSession && !currentSession.closedAt;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('settingsPage.daySession')}</h2>
          <p className="text-sm text-gray-500">{t('settingsPage.daySessionDesc')}</p>
        </div>

        {/* Current session status */}
        <div className={`rounded-xl border p-5 ${isOpen ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-3 mb-3">
            {isOpen ? (
              <Unlock size={20} className="text-green-600" />
            ) : (
              <Lock size={20} className="text-gray-500" />
            )}
            <span className={`text-sm font-semibold ${isOpen ? 'text-green-700' : 'text-gray-700'}`}>
              {isOpen ? t('settingsPage.sessionOpen') : t('settingsPage.sessionClosed')}
            </span>
          </div>

          {isOpen && currentSession && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">{t('settingsPage.openedAt')}</span>
                <span className="font-medium">{formatDateTime(currentSession.openedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('settingsPage.openingCash')}</span>
                <span className="font-medium">{formatCurrency(currentSession.openingCash)}</span>
              </div>
              {currentSession.expectedCash !== undefined && currentSession.expectedCash !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('settingsPage.expectedCash')}</span>
                  <span className="font-medium">{formatCurrency(currentSession.expectedCash)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Open or Close session */}
        {isOpen ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">{t('settingsPage.closeDaySession')}</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.closingCashAmount')}</label>
              <div className="relative w-48">
                <CurrencyIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {currentSession?.expectedCash !== undefined && currentSession.expectedCash !== null && closingCash && (
              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('settingsPage.expected')}</span>
                  <span className="font-medium">{formatCurrency(currentSession.expectedCash)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-600">{t('settingsPage.actual')}</span>
                  <span className="font-medium">{formatCurrency(Math.round(parseFloat(closingCash) * 100))}</span>
                </div>
                <div className="flex justify-between mt-1 pt-1 border-t border-gray-200">
                  <span className="font-medium">{t('settingsPage.difference')}</span>
                  <span className={`font-bold ${
                    Math.round(parseFloat(closingCash) * 100) - currentSession.expectedCash >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {formatCurrency(Math.round(parseFloat(closingCash) * 100) - currentSession.expectedCash)}
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.notesOptional')}</label>
              <textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none resize-none"
                rows={2}
                placeholder={t('settingsPage.closingNotesPh')}
              />
            </div>

            <Button variant="danger" icon={<Lock size={16} />} onClick={handleCloseSession}>
              {t('settingsPage.closeDaySessionBtn')}
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">{t('settingsPage.openDaySessionSection')}</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.openingCashAmount')}</label>
              <div className="relative w-48">
                <CurrencyIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.notesOptional')}</label>
              <textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none resize-none"
                rows={2}
                placeholder={t('settingsPage.openingNotesPh')}
              />
            </div>
            <Button variant="success" icon={<Unlock size={16} />} onClick={handleOpenSession}>
              {t('settingsPage.openDaySessionBtn')}
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderLicense = () => {
    const status = licenseStatus;

    const stateMeta = {
      active:         { icon: <ShieldCheck size={40} className="text-green-500" />, color: 'text-green-600', labelKey: 'licStateActive' as const },
      expiring_soon:  { icon: <ShieldAlert size={40} className="text-amber-500" />, color: 'text-amber-600', labelKey: 'licStateExpiringSoon' as const },
      expired_grace:  { icon: <ShieldAlert size={40} className="text-orange-500" />, color: 'text-orange-600', labelKey: 'licStateExpiredGrace' as const },
      expired_hard:   { icon: <ShieldX size={40} className="text-red-500" />,    color: 'text-red-600',   labelKey: 'licStateExpired' as const },
      invalid:        { icon: <ShieldX size={40} className="text-red-500" />,    color: 'text-red-600',   labelKey: 'licStateInvalid' as const },
      unlicensed:     { icon: <ShieldX size={40} className="text-gray-400" />,   color: 'text-gray-500',  labelKey: 'licStateUnlicensed' as const },
    };

    const state = status?.state ?? 'unlicensed';
    const meta = stateMeta[state as keyof typeof stateMeta] ?? stateMeta.unlicensed;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('settingsPage.license')}</h2>
          <p className="text-sm text-gray-500">{t('settingsPage.licenseDesc')}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-start gap-5">
            <div className="flex-shrink-0">{meta.icon}</div>
            <div className="flex-1 min-w-0">
              <p className={`text-base font-semibold ${meta.color}`}>{t(`settingsPage.${meta.labelKey}`)}</p>

              {!!status?.tier && (
                <p className="text-sm text-gray-600 mt-1">
                  {t('settingsPage.licPlan')}{' '}
                  <span className="font-medium">{t('settingsPage.licPlanMonth', { count: status.tier })}</span>
                </p>
              )}

              {status?.expiryDate && (
                <p className="text-sm text-gray-600 mt-0.5">
                  {t('settingsPage.licExpiry')}{' '}
                  <span className="font-medium">
                    {new Date(status.expiryDate).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </span>
                </p>
              )}

              {state === 'active' && status?.daysRemaining !== undefined && (
                <p className="text-sm text-gray-500 mt-0.5">
                  {t('settingsPage.licDaysLeft', { count: status.daysRemaining })}
                </p>
              )}

              {state === 'expiring_soon' && status?.daysRemaining !== undefined && (
                <p className="text-sm text-amber-600 mt-1 font-medium">
                  {t('settingsPage.licRenewSoon', { count: status.daysRemaining })}
                </p>
              )}

              {state === 'expired_grace' && status?.daysRemaining !== undefined && (
                <p className="text-sm text-orange-600 mt-1 font-medium">
                  {t('settingsPage.licGraceWarn', { count: status.daysRemaining })}
                </p>
              )}

              {(state === 'expired_hard' || state === 'invalid' || state === 'unlicensed') && (
                <p className="text-sm text-red-500 mt-1">{t('settingsPage.licContactVendor')}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-400 space-y-1">
          <p>{t('settingsPage.licRenewHelp1')}</p>
          <p>{t('settingsPage.licRenewHelp2')}</p>
        </div>
      </div>
    );
  };

  const [waStatus, setWaStatus] = useState<string>('disconnected');
  const [waQrCode, setWaQrCode] = useState<string>('');
  const [waConnecting, setWaConnecting] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!waQrCode || !qrCanvasRef.current) return;
    import('qrcode').then((QRCode) => {
      const toCanvas = QRCode.toCanvas || QRCode.default?.toCanvas;
      if (toCanvas && qrCanvasRef.current) {
        toCanvas(qrCanvasRef.current, waQrCode, { width: 256, margin: 2 }, (err: any) => {
          if (err) console.error('QR render failed:', err);
        });
      }
    }).catch((err) => {
      console.error('Failed to load qrcode module:', err);
    });
  }, [waQrCode]);

  useEffect(() => {
    if (!WHATSAPP_FEATURE_ENABLED || (activeSection as string) !== 'whatsapp') return;
    ipc<any>(window.electronAPI.whatsapp.getStatus()).then((res: any) => {
      const s = typeof res === 'string' ? res : (res?.data ?? 'disconnected');
      setWaStatus(s);
    }).catch(() => {});
    ipc<any>(window.electronAPI.whatsapp.getLastQr()).then((res: any) => {
      const qr = typeof res === 'string' ? res : (res?.data ?? '');
      if (qr) setWaQrCode(qr);
    }).catch(() => {});

    const onStatusChange = (newStatus: string) => {
      setWaStatus(newStatus);
      if (newStatus === 'connected') setWaConnecting(false);
      if (newStatus === 'disconnected') setWaConnecting(false);
    };
    const onQrCode = (qrDataUri: string) => {
      setWaQrCode(qrDataUri);
    };
    const statusSub = window.electronAPI.on('whatsapp:event:statusChange', onStatusChange);
    const qrSub = window.electronAPI.on('whatsapp:event:qr', onQrCode);
    return () => {
      window.electronAPI.removeListener('whatsapp:event:statusChange', statusSub);
      window.electronAPI.removeListener('whatsapp:event:qr', qrSub);
    };
  }, [activeSection]);

  const DEFAULT_COIN_SLABS = [
    { minAmount: 500, coins: 5 },
    { minAmount: 1000, coins: 15 },
    { minAmount: 2000, coins: 35 },
    { minAmount: 3000, coins: 60 },
  ];

  const parseCoinSlabs = (): { minAmount: number; coins: number }[] => {
    try {
      const raw = settings.coin_slabs;
      if (!raw) return DEFAULT_COIN_SLABS;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      return DEFAULT_COIN_SLABS;
    } catch {
      return DEFAULT_COIN_SLABS;
    }
  };

  const renderCoins = () => {
    const isEnabled = settings.coins_enabled === 'true';
    const slabs = parseCoinSlabs();

    const handleToggleCoins = async () => {
      const newVal = isEnabled ? 'false' : 'true';
      await setSetting('coins_enabled', newVal);
      if (newVal === 'true' && !settings.coin_slabs) {
        await setSetting('coin_slabs', JSON.stringify(DEFAULT_COIN_SLABS));
      }
    };

    const handleSlabChange = async (index: number, field: 'minAmount' | 'coins', value: string) => {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 0) return;
      const updated = [...slabs];
      updated[index] = { ...updated[index], [field]: num };
      await setSetting('coin_slabs', JSON.stringify(updated));
    };

    const handleAddSlab = async () => {
      const lastMin = slabs.length > 0 ? slabs[slabs.length - 1].minAmount : 0;
      const updated = [...slabs, { minAmount: lastMin + 1000, coins: 10 }];
      await setSetting('coin_slabs', JSON.stringify(updated));
    };

    const handleRemoveSlab = async (index: number) => {
      const updated = slabs.filter((_, i) => i !== index);
      await setSetting('coin_slabs', JSON.stringify(updated));
    };

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{t('settings.coinRewardsTitle')}</h3>
          <p className="text-sm text-gray-500 mt-1">
            {t('settings.coinRewardsDesc', { currency: currencySymbolForLanguage(i18n.language) })}
          </p>
        </div>

        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-4">
          <div>
            <p className="font-medium text-gray-700">{t('settings.enableCoinRewards')}</p>
            <p className="text-sm text-gray-400">{t('settings.enableCoinRewardsDesc')}</p>
          </div>
          <button type="button" onClick={handleToggleCoins}>
            {isEnabled ? <ToggleRight size={32} className="text-green-500" /> : <ToggleLeft size={32} className="text-gray-400" />}
          </button>
        </div>

        {isEnabled && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-700">{t('settings.coinSlabs')}</p>
                <p className="text-xs text-gray-400">{t('settings.coinSlabsDesc')}</p>
              </div>
              <button
                type="button"
                onClick={handleAddSlab}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus size={14} /> {t('settings.addSlab')}
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_1fr_40px] gap-3 text-xs font-medium text-gray-500 px-1">
                <span>{t('settings.minBillAmount', { currency: currencySymbolForLanguage(i18n.language) })}</span>
                <span>{t('settings.coinsEarned')}</span>
                <span />
              </div>
              {slabs.map((slab, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_40px] gap-3 items-center">
                  <input
                    type="number"
                    min="0"
                    value={slab.minAmount}
                    onChange={(e) => handleSlabChange(idx, 'minAmount', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    value={slab.coins}
                    onChange={(e) => handleSlabChange(idx, 'coins', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveSlab(idx)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            {slabs.length > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  {(() => {
                    const testAmount = slabs.length > 1 ? slabs[1].minAmount + 200 : 600;
                    let earned = 0;
                    for (const s of slabs) {
                      if (testAmount >= s.minAmount) earned = s.coins;
                    }
                    return t('settings.coinSlabHint', {
                      currency: currencySymbolForLanguage(i18n.language),
                      amount: testAmount,
                      coins: earned,
                    });
                  })()}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'restaurant': return renderRestaurantProfile();
      case 'tax': return renderTaxConfig();
      case 'printer': return renderPrinterSetup();
      case 'billing': return renderBillingSettings();
      case 'offers': return renderOffers();
      case 'backup': return renderBackup();
      case 'cloud': return renderCloud();
      case 'day_session': return renderDaySession();
      case 'license': return renderLicense();
      case 'appearance': return renderAppearance();
      case 'language': return renderLanguage();
      case 'coins': return renderCoins();
      case 'kitchen_network': return renderKitchenNetwork();
      case 'waiter_network': return renderWaiterNetwork();
      case 'system_update': return renderSystemUpdate();
      default: return null;
    }
  };

  const renderRoleNetwork = (
    role: 'kitchen' | 'waiter',
    titleKey: string,
    titleFallback: string,
    descKey: string,
    descFallback: string,
    enableLabelKey: string,
    enableLabelFallback: string,
    qr: string | null,
    showPortField: boolean,
  ) => {
    const info = netInfo;
    const roleInfo = info ? info[role] : { enabled: false, token: '', url: null };
    const enabled = roleInfo.enabled;
    const running = info?.running ?? false;

    const api = role === 'kitchen' ? window.electronAPI.kitchenNetwork : window.electronAPI.waiterNetwork;

    const handleToggle = async () => {
      if (netBusy) return;
      setNetBusy(true);
      try {
        await ipc(api.setEnabled(!enabled));
        await refreshNetInfo();
        toast.success(
          enabled
            ? t('settings.networkDisabled', 'Network access disabled')
            : t('settings.networkEnabled', 'Network access enabled'),
        );
      } catch (err: any) {
        toast.error(err?.message ?? t('settingsPage.networkToggleFailed'));
      } finally {
        setNetBusy(false);
      }
    };

    const handleSavePort = async () => {
      const port = parseInt(kitchenNetPortInput, 10);
      if (!Number.isFinite(port) || port < 1 || port > 65535) {
        toast.error(t('settings.kitchenNetworkInvalidPort', 'Port must be between 1 and 65535'));
        return;
      }
      if (port === info?.port) return;
      setNetBusy(true);
      try {
        await ipc(window.electronAPI.kitchenNetwork.setPort(port));
        await refreshNetInfo();
        toast.success(t('settings.kitchenNetworkPortUpdated', 'Port updated'));
      } catch (err: any) {
        toast.error(err?.message ?? t('settingsPage.portUpdateFailed'));
      } finally {
        setNetBusy(false);
      }
    };

    const handleCopyUrl = () => {
      if (!roleInfo.url) return;
      navigator.clipboard.writeText(roleInfo.url).then(
        () => toast.success(t('settings.copied', 'Copied')),
        () => toast.error(t('settingsPage.copyFailed')),
      );
    };

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{t(titleKey, titleFallback)}</h3>
          <p className="text-sm text-gray-500">{t(descKey, descFallback)}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{t(enableLabelKey, enableLabelFallback)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {running
                  ? t('settings.kitchenNetworkRunning', 'Server is running.')
                  : t('settings.kitchenNetworkStopped', 'Server is stopped.')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggle}
              disabled={netBusy}
              className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {enabled ? (
                <ToggleRight size={28} className="text-green-600" />
              ) : (
                <ToggleLeft size={28} className="text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {enabled && (
          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
            {showPortField && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.kitchenNetworkPort', 'Port')}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={kitchenNetPortInput}
                    onChange={(e) => setKitchenNetPortInput(e.target.value)}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <Button variant="secondary" size="sm" onClick={handleSavePort} loading={netBusy} disabled={kitchenNetPortInput === String(info?.port ?? '')}>
                    {t('common.save', 'Save')}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {t('settings.kitchenNetworkPortHint', 'Default 3030. Make sure the port is open in your firewall.')}
                </p>
              </div>
            )}

            {!showPortField && (
              <p className="text-xs text-gray-500">
                {t('settings.networkSharedPort', 'Uses the same port as the Kitchen Network. Configure the port from Kitchen Network settings.')}
              </p>
            )}

            {roleInfo.url ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {role === 'kitchen'
                    ? t('settings.kitchenNetworkUrl', 'Open this URL on the kitchen tablet')
                    : t('settings.waiterNetworkUrl', 'Open this URL on the waiter tablet')}
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono break-all">{roleInfo.url}</code>
                  <Button variant="secondary" size="sm" icon={<Copy size={14} />} onClick={handleCopyUrl}>
                    {t('settings.copy', 'Copy')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                {t('settings.kitchenNetworkNoLan', 'Could not detect a LAN IP address. Make sure this PC is connected to your local network (WiFi or Ethernet).')}
              </div>
            )}

            {qr && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.kitchenNetworkQrLabel', 'Or scan this QR code with the tablet')}</label>
                <div className="inline-block p-2 bg-white border border-gray-200 rounded-lg">
                  <img src={qr} alt={t('settingsPage.urlQrAlt')} width={200} height={200} />
                </div>
              </div>
            )}

            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              {t('settings.networkNoAuthWarning', 'No password is required to open this URL. Anyone on your local network can use it. Make sure your staff WiFi is separate from any guest network.')}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderKitchenNetwork = () =>
    renderRoleNetwork(
      'kitchen',
      'settings.kitchenNetworkTitle', 'Kitchen Network Access',
      'settings.kitchenNetworkDesc', 'Allow tablets or other devices on your local network to open the Kitchen Display in a browser. Useful when your kitchen is on a different machine than the billing PC.',
      'settings.kitchenNetworkEnableLabel', 'Enable kitchen network access',
      kitchenQr,
      true,
    );

  const renderWaiterNetwork = () =>
    renderRoleNetwork(
      'waiter',
      'settings.waiterNetworkTitle', 'Waiter Network Access',
      'settings.waiterNetworkDesc', 'Allow waiters to take orders from a tablet or phone on your local network. Orders sent from the tablet appear instantly in the billing screen, and KOTs are auto-printed in the kitchen.',
      'settings.waiterNetworkEnableLabel', 'Enable waiter network access',
      waiterQr,
      false,
    );

  const renderSystemUpdate = () => {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {t('settings.systemUpdateTitle', 'System Update')}
          </h3>
          <p className="text-sm text-gray-500">
            {t('settings.systemUpdateDesc', 'Check and install updates to keep the system up to date.')}
          </p>
        </div>

        {/* Current Version Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <RefreshCw size={24} className={updateState === 'checking' ? 'animate-spin' : ''} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{t('settings.currentVersion', 'Current Version')}</p>
              <p className="text-xs text-gray-500 font-mono mt-0.5">v{appVersion || '...'}</p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={handleCheckForUpdates}
            disabled={updateState === 'checking' || updateState === 'downloading' || updateState === 'ready'}
            loading={updateState === 'checking'}
            icon={<RefreshCw size={16} />}
          >
            {updateState === 'checking'
              ? t('settings.checkingUpdates', 'Checking...')
              : t('settings.checkUpdates', 'Check for Updates')}
          </Button>
        </div>

        {/* Update Status Details */}
        {updateState !== 'idle' && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Update Status</h3>
            
            {updateState === 'checking' && (
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Loader2 size={18} className="animate-spin text-blue-500" />
                <span>{t('settings.checkingUpdates', 'Checking for updates...')}</span>
              </div>
            )}

            {updateState === 'no-update' && (
              <div className="flex items-center gap-3 text-sm text-green-600">
                <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center text-green-600 flex-shrink-0">
                  <Check size={14} />
                </div>
                <span>{t('settings.upToDate', 'Your system is up to date.')}</span>
              </div>
            )}

            {updateState === 'available' && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-800">
                  {t('settings.updateAvailable', 'Update available: {{version}}', { version: updateVersion })}
                </p>
                <p className="text-xs text-gray-500">
                  Downloading update in the background...
                </p>
              </div>
            )}

            {updateState === 'downloading' && (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {t('settings.updateDownloading', 'Downloading update... {{progress}}%', { progress: downloadProgress })}
                  </span>
                  <span className="font-semibold text-blue-600">{downloadProgress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {updateState === 'ready' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-blue-900">
                    {t('settings.updateReady', 'Update ready: {{version}}', { version: updateVersion })}
                  </p>
                  <p className="text-xs text-blue-700">
                    {t('settings.updateReadyDesc', 'Restart the application to apply the update.')}
                  </p>
                </div>
                <Button
                  variant="primary"
                  onClick={() => window.electronAPI.updater.installNow()}
                  icon={<Download size={16} />}
                >
                  {t('settings.restartAndUpdate', 'Restart & Update')}
                </Button>
              </div>
            )}

            {updateState === 'error' && (
              <div className="flex items-start gap-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Update check failed</p>
                  <p className="text-xs text-red-500 mt-1">{updateError}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderAppearance = () => {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{t('settings.appearanceTitle')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.appearanceDesc')}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setTheme('light')}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              currentTheme === 'light'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                <Sun size={20} className="text-yellow-500" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{t('settings.themeLight')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.themeLightDesc')}</p>
              </div>
            </div>
            <div className="rounded-lg overflow-hidden border border-gray-200">
              <div className="h-3 bg-white" />
              <div className="flex">
                <div className="w-6 bg-gray-900 h-8" />
                <div className="flex-1 bg-gray-100 h-8 p-1">
                  <div className="w-full h-full bg-white rounded-sm" />
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              currentTheme === 'dark'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center">
                <Moon size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{t('settings.themeDark')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.themeDarkDesc')}</p>
              </div>
            </div>
            <div className="rounded-lg overflow-hidden border border-gray-700">
              <div className="h-3 bg-gray-800" />
              <div className="flex">
                <div className="w-6 bg-gray-950 h-8" />
                <div className="flex-1 bg-gray-900 h-8 p-1">
                  <div className="w-full h-full bg-gray-800 rounded-sm" />
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  };

  const renderLanguage = () => {
    const resolveLng = (code: string): LocaleCode =>
      LOCALE_CODES.includes(code as LocaleCode) ? (code as LocaleCode) : 'en';

    const activeUiLang = resolveLng(i18n.language.split('-')[0].toLowerCase());
    const currentCountry = getCountryById(countryId);

    const applyLanguage = (code: LocaleCode) => {
      const meta = LOCALE_DISPLAY[code];
      localStorage.setItem('app_language', code);
      void i18n.changeLanguage(resolveLng(code));
      toast.success(t('toast.languageSwitched', { flag: meta.flag, name: meta.native }));
    };

    const applyCountry = (id: CountryId) => {
      const c = getCountryById(id);
      setCountryId(id);
      const cur = resolveLng(i18n.language.split('-')[0].toLowerCase());
      if (!c.languages.includes(cur)) {
        localStorage.setItem('app_language', c.defaultLang);
        void i18n.changeLanguage(c.defaultLang);
      }
      toast.success(t('toast.countrySwitched', { name: t(c.nameKey) }));
    };

    const langOptions = currentCountry.languages.map((code) => ({
      code,
      ...LOCALE_DISPLAY[code],
    }));

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{t('language.title')}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{t('language.description')}</p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-800 mb-2">{t('language.countryTitle')}</h4>
          <p className="text-xs text-gray-500 mb-2.5">{t('language.countrySubtitle')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {COUNTRIES.map((c) => {
              const isSelected = countryId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => applyCountry(c.id)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left
                    ${isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  <span className="text-xl leading-none">{c.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>
                      {t(c.nameKey)}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {t(`language.currencyLabel.${c.currency}`)}
                    </p>
                  </div>
                  {isSelected ? (
                    <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <Check size={10} className="text-white" />
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {currentCountry.languages.length > 1 ? (
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-1">{t('language.languageTitle')}</h4>
            <p className="text-xs text-gray-500 mb-2.5">{t('language.languageSubtitle')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {langOptions.map((lang) => {
                const isSelected = activeUiLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => applyLanguage(lang.code)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left
                      ${isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    <span className="text-xl leading-none">{lang.flag}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>
                        {lang.native}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">{lang.label}</p>
                    </div>
                    {isSelected ? (
                      <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <Check size={10} className="text-white" />
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const renderDayEndSummaryModal = () => {
    if (!dayEndSummary) return null;
    const s = dayEndSummary;
    const modeIcons: Record<string, React.ReactNode> = {
      cash: <Banknote size={16} className="text-green-600" />,
      card: <CreditCard size={16} className="text-blue-600" />,
      upi: <Smartphone size={16} className="text-purple-600" />,
    };

    const paymentModeLabel = (mode: string) => {
      const key = mode as 'cash' | 'card' | 'upi';
      if (key === 'cash' || key === 'card' || key === 'upi') return t(`header.${key}`);
      return mode;
    };

    const orderTypeLabel = (type: string) => {
      const map: Record<string, string> = {
        dine_in: t('billing.dineIn'),
        takeaway: t('billing.takeaway'),
        delivery: t('billing.delivery'),
      };
      return map[type] ?? type.replace('_', ' ');
    };

    return (
      <Modal
        isOpen={showDayEndSummary}
        onClose={() => setShowDayEndSummary(false)}
        title={t('settingsPage.dayEndTitle')}
        size="lg"
        footer={
          <Button variant="primary" onClick={() => setShowDayEndSummary(false)}>
            {t('settingsPage.dayEndClose')}
          </Button>
        }
      >
        <div className="space-y-5">
          {/* Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-blue-900">{formatCurrency(s.totalRevenue)}</p>
              <p className="text-xs text-blue-600">{t('settingsPage.dayEndTotalRevenue')}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-green-900">{s.totalOrders}</p>
              <p className="text-xs text-green-600">{t('settingsPage.dayEndTotalOrders')}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-purple-900">{s.totalCovers}</p>
              <p className="text-xs text-purple-600">{t('settingsPage.dayEndItemsSold')}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-amber-900">{formatCurrency(s.averageOrderValue)}</p>
              <p className="text-xs text-amber-600">{t('settingsPage.dayEndAvgOrder')}</p>
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('settingsPage.dayEndPaymentBreakdown')}</h3>
            <div className="space-y-2">
              {(s.paymentBreakdown ?? []).map((p: any) => (
                <div key={p.mode} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-gray-700">
                    {modeIcons[p.mode] ?? null}
                    {paymentModeLabel(p.mode)}
                    <span className="text-xs text-gray-400">{t('settingsPage.dayEndTxns', { count: p.count })}</span>
                  </span>
                  <span className="font-medium">{formatCurrency(p.total)}</span>
                </div>
              ))}
              {(s.paymentBreakdown ?? []).length === 0 && (
                <p className="text-sm text-gray-400">{t('settingsPage.dayEndNoPayments')}</p>
              )}
            </div>
          </div>

          {/* Coin redemptions */}
          {(s.coinsRedeemed ?? 0) > 0 && (
            <div className="bg-yellow-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-yellow-800 mb-2">{t('settingsPage.coinRedemptions')}</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-yellow-700">{t('settingsPage.coinsRedeemedLabel')}</span>
                  <span className="font-medium text-yellow-800">{formatCurrency(s.coinsRedeemed)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-yellow-700">{t('settingsPage.coinsEarnedLabel')}</span>
                  <span className="font-medium text-yellow-800">{s.coinsEarned ?? 0}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-yellow-200">
                  <span className="font-medium text-yellow-800">{t('settingsPage.actualReceived')}</span>
                  <span className="font-bold text-yellow-900">{formatCurrency(s.totalRevenue - s.coinsRedeemed)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Cash reconciliation */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('settingsPage.dayEndCashRecon')}</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">{t('settingsPage.dayEndExpectedCash')}</span>
                <span className="font-medium">{formatCurrency(s.expectedCash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('settingsPage.dayEndActualClosing')}</span>
                <span className="font-medium">{formatCurrency(s.closingCash)}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-gray-200">
                <span className="font-medium">{t('settingsPage.difference')}</span>
                <span className={`font-bold ${(s.closingCash - s.expectedCash) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(s.closingCash - s.expectedCash)}
                </span>
              </div>
            </div>
          </div>

          {/* Top 5 items */}
          {(s.topItems ?? []).length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <TrendingUp size={14} />
                {t('settingsPage.dayEndTopItems')}
              </h3>
              <div className="space-y-2">
                {s.topItems.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">
                      <span className="text-gray-400 mr-2">#{i + 1}</span>
                      {item.name}
                    </span>
                    <span className="text-gray-500">
                      {t('settingsPage.dayEndSold', { qty: item.quantity, revenue: formatCurrency(item.revenue) })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Orders by type */}
          {(s.ordersByType ?? []).length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('settingsPage.dayEndOrdersByType')}</h3>
              <div className="flex gap-4">
                {s.ordersByType.map((row: any) => (
                  <div key={row.type} className="text-sm">
                    <span className="text-gray-600">{orderTypeLabel(row.type)}</span>
                    <span className="ml-2 font-medium">{t('settingsPage.dayEndOrdersCount', { count: row.count })}</span>
                    <span className="ml-1 text-gray-400">({formatCurrency(row.revenue)})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Discount & Tax */}
          <div className="flex gap-4 text-sm">
            <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center">
              <p className="font-bold text-gray-900">{formatCurrency(s.totalDiscount)}</p>
              <p className="text-xs text-gray-500">{t('settingsPage.dayEndTotalDiscounts')}</p>
            </div>
            <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center">
              <p className="font-bold text-gray-900">{formatCurrency(s.totalTax)}</p>
              <p className="text-xs text-gray-500">{t('settingsPage.dayEndTotalTax')}</p>
            </div>
          </div>
        </div>
      </Modal>
    );
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 bg-white border-r border-gray-200/80 overflow-y-auto">
          <div className="px-5 pt-5 pb-3">
            <h2 className="text-lg font-semibold tracking-tight text-gray-900">{t('nav.settings')}</h2>
          </div>
          <nav className="px-3 pb-6 space-y-5">
            {SECTION_GROUPS.map((group) => (
              <div key={group.fallback}>
                <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {t(group.labelKey, group.fallback)}
                </p>
                <div className="space-y-0.5">
                  {group.keys.map((key) => {
                    const section = sectionNavItems.find((s) => s.key === key);
                    if (!section) return null;
                    const isActive = activeSection === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleSectionChange(key)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <span className={isActive ? 'text-white' : 'text-gray-400'}>
                          {section.icon}
                        </span>
                        {section.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className={activeSection === 'printer' ? 'max-w-6xl' : 'max-w-2xl'}>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            {renderActiveSection()}
          </div>
        </div>
      </div>

      {/* Day-end summary modal */}
      {renderDayEndSummaryModal()}
    </div>
  );
};

export default Settings;
