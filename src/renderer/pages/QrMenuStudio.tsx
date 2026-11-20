import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  QrCode,
  Download,
  Printer,
  Smartphone,
  Tablet,
  Copy,
  Check,
  RefreshCw,
  Palette,
  Sliders,
  Wifi,
  UtensilsCrossed,
  Layers,
  Image as ImageIcon,
  ExternalLink,
  Eye,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  Cloud,
  Globe,
  UploadCloud,
  Terminal,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ipc } from '../lib/ipc';
import {
  generateMenuCanvas,
  downloadMenuImage,
  type MenuTheme,
  type MenuDataPayload,
} from '../lib/menuCanvasGenerator';
import { generateQrImage, downloadDataUri } from '../lib/qrCodeGenerator';
import { QR_STYLES, type QrStyle } from '../../shared/qr-render';
import CustomerMenu from './CustomerMenu';

type StudioTab = 'live-preview' | 'menu-image' | 'standalone-qr';

const QrMenuStudio: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<StudioTab>('live-preview');

  // Menu data from backend
  const [menuData, setMenuData] = useState<MenuDataPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkInfo, setNetworkInfo] = useState<any>(null);

  // General settings
  const [qrStyle, setQrStyle] = useState<QrStyle>('rounded');
  const [centerIcon, setCenterIcon] = useState(true);
  const [cardTitle, setCardTitle] = useState('Scan for Digital Menu');
  const [cardSubtitle, setCardSubtitle] = useState('Point phone camera at QR code • Live menu & specials');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [customWebUrl, setCustomWebUrl] = useState('');

  // Menu Image settings
  const [menuTheme, setMenuTheme] = useState<MenuTheme>('noir');
  const [showPrices, setShowPrices] = useState(true);
  const [showDescriptions, setShowDescriptions] = useState(true);
  const [showMiniQr, setShowMiniQr] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

  // Standalone QR settings
  const [standaloneSize, setStandaloneSize] = useState<number>(1024);

  // Previews
  const menuCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [menuImageDataUrl, setMenuImageDataUrl] = useState<string>('');
  const [standaloneQrDataUrl, setStandaloneQrDataUrl] = useState<string>('');
  const [menuImageError, setMenuImageError] = useState<string | null>(null);

  // Firebase Hosting & Multi-Customer Path States
  const [urlMode, setUrlMode] = useState<'cloud' | 'lan' | 'custom'>('cloud');
  const [cloudDomain, setCloudDomain] = useState<string>('https://molecule-e2e95.web.app');
  const [customerSlug, setCustomerSlug] = useState<string>('one-bite');
  const [exportingFirebase, setExportingFirebase] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [copiedDeployCmd, setCopiedDeployCmd] = useState(false);

  const [previewDevice, setPreviewDevice] = useState<'tablet' | 'phone'>('tablet');
  const tabletScrollRef = useRef<HTMLDivElement | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Mouse Drag-to-Pan for tablet preview
  useEffect(() => {
    const el = tabletScrollRef.current;
    if (!el) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('button, input, a, select')) return;

      isDown = true;
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
      el.style.userSelect = 'none';
    };

    const onMouseLeave = () => {
      isDown = false;
      el.style.removeProperty('user-select');
    };

    const onMouseUp = () => {
      isDown = false;
      el.style.removeProperty('user-select');
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 1.5;
      el.scrollLeft = scrollLeft - walk;
    };

    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('mouseleave', onMouseLeave);
    el.addEventListener('mouseup', onMouseUp);
    el.addEventListener('mousemove', onMouseMove);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('mouseleave', onMouseLeave);
      el.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('mousemove', onMouseMove);
    };
  }, [previewDevice, activeTab]);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      let data: MenuDataPayload | null = null;
      let net: any = null;

      // 1. Try Electron IPC
      if (typeof window !== 'undefined' && window.electronAPI?.qrMenu) {
        try {
          const [d, n] = await Promise.all([
            ipc<MenuDataPayload>(window.electronAPI.qrMenu.getMenuData()),
            ipc<any>(window.electronAPI.qrMenu.getInfo()),
          ]);
          data = d;
          net = n;
        } catch (ipcErr: any) {
          console.warn('Electron IPC qrMenu not responding yet, trying HTTP fallback:', ipcErr?.message);
        }
      }

      // 2. HTTP Fallback (if IPC not yet registered in dev main process or in browser mode)
      if (!data) {
        try {
          const res = await fetch('/api/qr-menu/menu');
          if (res.ok) {
            data = await res.json();
          }
        } catch {
          // ignore
        }
      }

      // 3. Static JSON fallback
      if (!data) {
        try {
          const defRes = await fetch('/menus/default.json');
          if (defRes.ok) {
            data = await defRes.json();
          }
        } catch {
          // ignore
        }
      }

      if (data) {
        setMenuData(data);
        setCardTitle(data.settings?.tableCardTitle || 'Scan for Digital Menu');
        setCardSubtitle(data.settings?.tableCardSubtitle || 'Point phone camera at QR code • Live menu & specials');
        setWifiSsid(data.settings?.wifiSsid || '');
        setWifiPassword(data.settings?.wifiPassword || '');
        setCustomWebUrl(data.settings?.customUrl || '');

        if ((data.settings as any)?.urlMode) {
          setUrlMode((data.settings as any).urlMode);
        }
        if ((data.settings as any)?.cloudDomain) {
          setCloudDomain((data.settings as any).cloudDomain);
        }
        const defaultSlug = (data.settings as any)?.customerSlug || (data.restaurant.name || 'one-bite')
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'one-bite';
        setCustomerSlug((data.settings as any)?.customerSlug || defaultSlug);

        if (data.settings?.theme && ['noir', 'ivory', 'minimal', 'royal'].includes(data.settings.theme)) {
          setMenuTheme(data.settings.theme as MenuTheme);
        }
      }
      if (net) setNetworkInfo(net);
    } catch (err: any) {
      console.error('Failed to load QR menu data:', err);
      toast.error(err?.message || 'Failed to load QR menu data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute effective base and table-specific menu URLs
  const getBaseMenuUrl = (): string => {
    let base = '';
    const defSlug = (menuData?.settings as any)?.customerSlug || (menuData?.restaurant?.name || 'one-bite')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'one-bite';
    const effectiveSlug = (customerSlug || defSlug).trim().toLowerCase();
    const cleanDomain = (cloudDomain || 'https://molecule-e2e95.web.app').replace(/\/+$/, '');

    if (urlMode === 'cloud') {
      base = `${cleanDomain}/m/${effectiveSlug}`;
    } else if (urlMode === 'custom' && customWebUrl.trim().length > 0) {
      base = customWebUrl.trim().replace(/\/+$/, '');
    } else {
      base = (networkInfo?.qrMenu?.url || 'http://localhost:3030/qr-menu').replace(/\/+$/, '');
    }
    return base;
  };

  const getTargetUrlForTable = (tableId: number | 'general'): string => {
    const base = getBaseMenuUrl();
    if (tableId === 'general') return base;
    const tableObj = menuData?.tables.find((t) => t.id === tableId);
    const tableName = tableObj ? tableObj.name : `Table ${tableId}`;
    return `${base}?table=${encodeURIComponent(tableName)}&tableId=${tableId}`;
  };

  const activeTargetUrl = getBaseMenuUrl();

  // Re-generate Menu Image Preview when options change
  useEffect(() => {
    if (!menuData) return;
    let isMounted = true;

    const renderMenuPreview = async () => {
      try {
        setMenuImageError(null);
        const canvas = await generateMenuCanvas(menuData, {
          theme: menuTheme,
          title: menuData.restaurant.name,
          subtitle: menuData.settings?.subtitle,
          qrUrl: activeTargetUrl,
          qrStyle,
          showPrices,
          showDescriptions,
          showMiniQr,
          selectedCategoryIds: selectedCategories.length > 0 ? selectedCategories : undefined,
        });

        if (isMounted) {
          menuCanvasRef.current = canvas;
          setMenuImageDataUrl(canvas.toDataURL('image/png'));
        }
      } catch (err: any) {
        console.error('Failed to render menu image preview:', err);
        if (isMounted) {
          setMenuImageError(err?.message || 'Failed to render menu image preview');
        }
      }
    };

    renderMenuPreview();
    return () => {
      isMounted = false;
    };
  }, [
    menuData,
    menuTheme,
    showPrices,
    showDescriptions,
    showMiniQr,
    selectedCategories,
    activeTargetUrl,
    qrStyle,
  ]);

  // Re-generate Standalone QR Preview
  useEffect(() => {
    let isMounted = true;
    const generateQr = async () => {
      try {
        const dataUri = await generateQrImage(activeTargetUrl, {
          style: qrStyle,
          size: standaloneSize,
          centerIcon,
          label: menuData?.restaurant.name,
          sublabel: 'Scan to View Digital Menu',
        });
        if (isMounted) {
          setStandaloneQrDataUrl(dataUri);
        }
      } catch (err) {
        console.error('Failed to generate standalone QR:', err);
      }
    };
    generateQr();
    return () => {
      isMounted = false;
    };
  }, [activeTargetUrl, qrStyle, standaloneSize, centerIcon, menuData]);

  // Save Settings to Backend
  const handleSaveSettings = async () => {
    try {
      if (window.electronAPI?.qrMenu?.saveSettings) {
        await ipc(
          window.electronAPI.qrMenu.saveSettings({
            qr_menu_table_card_title: cardTitle,
            qr_menu_table_card_subtitle: cardSubtitle,
            qr_menu_wifi_ssid: wifiSsid,
            qr_menu_wifi_password: wifiPassword,
            qr_menu_custom_url: customWebUrl,
            qr_menu_theme: menuTheme,
            qr_menu_style: qrStyle,
            qr_menu_url_mode: urlMode,
            qr_menu_cloud_domain: cloudDomain,
            qr_menu_customer_slug: customerSlug,
          })
        );
        toast.success(t('qrMenu.settingsSaved', 'QR Menu settings saved!'));
      } else {
        toast.success(t('qrMenu.settingsSaved', 'QR Menu settings updated!'));
      }
    } catch (err: any) {
      console.warn('Failed to save settings via IPC:', err);
      toast.error(err?.message || 'Failed to save settings');
    }
  };

  // Automatic Cloud Publish (Zero Customer Firebase Login)
  const handleSyncToCloud = async () => {
    setSyncingCloud(true);
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.qrMenu?.publishToCloud) {
        const res = await ipc<any>((window as any).electronAPI.qrMenu.publishToCloud(customerSlug));
        setLastSyncTime(new Date().toLocaleTimeString());
        toast.success(`Menu live at /m/${res.slug}! Automatically synced to cloud.`);
      } else {
        toast.success('Settings saved! Menu auto-syncs on change.');
      }
    } catch (err: any) {
      console.warn('Cloud sync error:', err);
      toast.error(err?.message || 'Failed to sync menu to cloud');
    } finally {
      setSyncingCloud(false);
    }
  };

  // Export Menu Package for Firebase Hosting
  const handleExportFirebaseMenu = async () => {
    setExportingFirebase(true);
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.qrMenu?.exportFirebaseMenu) {
        const res = await ipc<any>((window as any).electronAPI.qrMenu.exportFirebaseMenu(customerSlug));
        toast.success(`Menu exported for customer path /m/${res.slug}!`);
      } else {
        // Browser fallback: download JSON file directly
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(menuData, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute('href', dataStr);
        dlAnchor.setAttribute('download', `${customerSlug || 'menu'}.json`);
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        dlAnchor.remove();
        toast.success(`Downloaded ${customerSlug || 'menu'}.json! Place into out/renderer/menus/ to deploy.`);
      }
    } catch (err: any) {
      console.error('Failed to export Firebase menu:', err);
      toast.error(err?.message || 'Failed to export menu');
    } finally {
      setExportingFirebase(false);
    }
  };

  const copyDeployCmd = () => {
    navigator.clipboard.writeText('npm run deploy:firebase').then(() => {
      setCopiedDeployCmd(true);
      setTimeout(() => setCopiedDeployCmd(false), 2500);
      toast.success('Copied: npm run deploy:firebase');
    });
  };





  // Download Menu Image
  const handleDownloadMenuImage = () => {
    if (!menuImageDataUrl || !menuData) return;
    const safeName = (menuData.restaurant.name || 'menu').replace(/\s+/g, '-').toLowerCase();
    downloadDataUri(menuImageDataUrl, `molecule-menu-${safeName}.png`);
    toast.success(t('qrMenu.menuDownloaded', 'Menu image downloaded!'));
  };

  // Print Menu Card
  const handlePrintMenuImage = () => {
    if (!menuImageDataUrl) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popup blocked. Please allow popups to print.');
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Menu - ${menuData?.restaurant.name || 'Molecule'}</title>
          <style>
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fff; }
            img { max-width: 100vw; max-height: 100vh; object-fit: contain; }
          </style>
        </head>
        <body>
          <img src="${menuImageDataUrl}" onload="window.print(); window.close();" />
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(activeTargetUrl).then(() => {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
      toast.success(t('common.copied', 'URL copied to clipboard!'));
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
        {/* Studio Top Header Shimmer */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 flex items-center justify-center">
              <QrCode size={20} className="text-white/60" />
            </div>
            <div>
              <div className="shimmer h-5 w-36 rounded mb-1" />
              <div className="shimmer h-3 w-72 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="shimmer h-8 w-48 rounded-lg" />
            <div className="shimmer h-8 w-8 rounded-lg" />
          </div>
        </div>

        {/* Tabs Shimmer */}
        <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center gap-3">
          <div className="shimmer h-7 w-48 rounded-md" />
          <div className="shimmer h-7 w-44 rounded-md" />
          <div className="shimmer h-7 w-40 rounded-md" />
        </div>

        {/* Studio Content Shimmer */}
        <div className="flex-1 overflow-hidden p-6 flex flex-col lg:flex-row gap-6">
          {/* Left Controls Column */}
          <div className="w-full lg:w-[420px] shrink-0 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="shimmer h-4 w-32 rounded" />
              <div className="shimmer h-9 w-full rounded-lg" />
              <div className="shimmer h-9 w-full rounded-lg" />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="shimmer h-4 w-28 rounded" />
              <div className="grid grid-cols-4 gap-2">
                <div className="shimmer h-12 rounded-lg" />
                <div className="shimmer h-12 rounded-lg" />
                <div className="shimmer h-12 rounded-lg" />
                <div className="shimmer h-12 rounded-lg" />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="shimmer h-4 w-40 rounded" />
              <div className="shimmer h-10 w-full rounded-lg" />
            </div>
          </div>

          {/* Right Live Preview Column */}
          <div className="flex-1 bg-white rounded-xl border border-gray-200 p-8 flex flex-col items-center justify-center">
            <div className="w-64 max-w-full space-y-4 text-center">
              <div className="shimmer h-48 w-48 mx-auto rounded-2xl" />
              <div className="shimmer h-4 w-36 mx-auto rounded" />
              <div className="shimmer h-3 w-48 mx-auto rounded" />
              <div className="shimmer h-9 w-40 mx-auto rounded-lg mt-4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* ── Studio Top Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <QrCode size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">QR Menu Studio</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Design, preview, and download beautiful table stands, digital menu cards, and QR codes
              </p>
            </div>
          </div>
        </div>

        {/* Server & URL Status Indicator */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                networkInfo?.running ? 'bg-green-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="font-mono text-gray-700 dark:text-gray-300 truncate max-w-[220px]">
              {activeTargetUrl}
            </span>
            <button
              type="button"
              onClick={copyUrl}
              className="text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 p-0.5 ml-1 transition"
              title="Copy URL"
            >
              {copiedUrl ? <Check size={14} className="text-green-600 dark:text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>

          <button
            type="button"
            onClick={fetchData}
            className="p-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition"
            title="Refresh Data"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'live-preview', label: 'Live Digital Menu & Cloud Sync', icon: <Globe size={16} /> },
          { id: 'menu-image', label: 'Menu Poster Board (Print)', icon: <ImageIcon size={16} /> },
          { id: 'standalone-qr', label: 'Standalone QR Code', icon: <QrCode size={16} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as StudioTab)}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 font-medium text-xs whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Main Tab View Area ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ========================================================================= */}
        {/* TAB 2: BEAUTIFUL MENU IMAGE                                              */}
        {/* ========================================================================= */}
        {activeTab === 'menu-image' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
            {/* Left Controls (5 cols) */}
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                  <Palette size={16} className="text-blue-600 dark:text-blue-400" />
                  <span>Menu Image Customization</span>
                </h3>

                {/* Theme Selector */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Poster Theme
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'noir', name: 'Modern Noir', desc: 'Obsidian Black & Gold' },
                      { id: 'ivory', name: 'Vintage Bistro', desc: 'Warm Ivory & Espresso' },
                      { id: 'minimal', name: 'Minimal White', desc: 'Crisp White & Emerald' },
                      { id: 'royal', name: 'Royal Navy', desc: 'Deep Blue & Champagne' },
                    ].map((th) => (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => setMenuTheme(th.id as MenuTheme)}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          menuTheme === th.id
                            ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 font-bold'
                            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <span className="text-xs font-bold block">{th.name}</span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 block">{th.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Display Toggles */}
                <div className="space-y-2.5 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Show Dish Prices</span>
                    <input
                      type="checkbox"
                      checked={showPrices}
                      onChange={(e) => setShowPrices(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Show Descriptions & Sizes</span>
                    <input
                      type="checkbox"
                      checked={showDescriptions}
                      onChange={(e) => setShowDescriptions(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Include Bottom Mini QR Code</span>
                    <input
                      type="checkbox"
                      checked={showMiniQr}
                      onChange={(e) => setShowMiniQr(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Category Selection */}
                <div className="pt-2 border-t border-gray-100">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Filter Categories (Optional)
                  </label>
                  <p className="text-[11px] text-gray-500 mb-2">
                    Leave blank to include all categories, or pick specific sections.
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {menuData?.categories.map((c) => {
                      const isSelected = selectedCategories.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCategories(selectedCategories.filter((id) => id !== c.id));
                            } else {
                              setSelectedCategories([...selectedCategories, c.id]);
                            }
                          }}
                          className={`w-full px-3 py-1.5 rounded-lg border text-left text-xs flex items-center justify-between transition ${
                            isSelected
                              ? 'bg-blue-50 border-blue-600 text-blue-700 font-bold'
                              : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <span>{c.name}</span>
                          {isSelected && <Check size={14} className="text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Preview Column (7 cols) */}
            <div className="lg:col-span-7 flex flex-col items-center">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm w-full flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                      Full Menu Card Preview (A4 Ratio)
                    </h3>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Ultra High-Res 1800x2600 px</span>
                </div>

                {/* Canvas Render Image */}
                <div className="p-3 bg-gray-100 dark:bg-gray-900 rounded-2xl border border-gray-300 dark:border-gray-700 shadow-inner flex items-center justify-center max-w-full overflow-hidden">
                  {menuImageDataUrl ? (
                    <img
                      src={menuImageDataUrl}
                      alt="Menu Poster Preview"
                      className="max-h-[500px] w-auto object-contain rounded-lg shadow-xl"
                    />
                  ) : menuImageError ? (
                    <div className="h-96 w-64 flex flex-col items-center justify-center text-red-500 text-xs p-4 text-center">
                      <AlertCircle size={24} className="mb-2 text-red-400" />
                      <span className="font-semibold">{menuImageError}</span>
                    </div>
                  ) : (
                    <div className="h-96 w-64 flex flex-col items-center justify-center text-gray-400 text-xs gap-2">
                      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      <span>Rendering menu card...</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons Bar */}
                <div className="w-full grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={handleDownloadMenuImage}
                    className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition"
                  >
                    <Download size={15} />
                    <span>Download Menu Image (PNG)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintMenuImage}
                    className="py-3 px-4 bg-gray-900 hover:bg-black dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition"
                  >
                    <Printer size={15} />
                    <span>Print Menu (A4)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: STANDALONE QR CODE                                                */}
        {/* ========================================================================= */}
        {activeTab === 'standalone-qr' && (
          <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
            <div className="text-center space-y-1">
              <h3 className="font-bold text-gray-900 dark:text-white text-lg">Standalone QR Code Generator</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Download a clean, transparent or high-contrast standalone QR code for external marketing or custom table acrylics.
              </p>
            </div>

            {/* QR Preview Card */}
            <div className="flex flex-col items-center justify-center py-6">
              <div className="p-4 bg-white border border-gray-200 dark:border-gray-600 rounded-3xl shadow-xl inline-block">
                {standaloneQrDataUrl ? (
                  <img
                    src={standaloneQrDataUrl}
                    alt="Standalone QR"
                    className="w-64 h-64 sm:w-80 sm:h-80 object-contain mx-auto"
                  />
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center text-xs text-gray-400">
                    Generating QR...
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Resolution / Pixel Size
                </label>
                <select
                  value={standaloneSize}
                  onChange={(e) => setStandaloneSize(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-medium text-gray-900 dark:text-gray-100 outline-none"
                >
                  <option value={512}>512 x 512 px (Small / Digital Web)</option>
                  <option value={1024}>1024 x 1024 px (Standard Print)</option>
                  <option value={2048}>2048 x 2048 px (Ultra HD / Large Posters)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  QR Pattern Style
                </label>
                <select
                  value={qrStyle}
                  onChange={(e) => setQrStyle(e.target.value as QrStyle)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-medium text-gray-900 dark:text-gray-100 outline-none"
                >
                  {QR_STYLES.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={copyUrl}
                className="py-3 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
              >
                {copiedUrl ? <Check size={15} className="text-green-600 dark:text-emerald-400" /> : <Copy size={15} />}
                <span>{copiedUrl ? 'Copied' : 'Copy Menu Link'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (standaloneQrDataUrl) {
                    downloadDataUri(standaloneQrDataUrl, `molecule-qr-code.png`);
                    toast.success('QR Code downloaded!');
                  }
                }}
                className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition"
              >
                <Download size={15} />
                <span>Download QR Image</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: LIVE MOBILE VIEW & SETTINGS                                        */}
        {/* ========================================================================= */}
        {activeTab === 'live-preview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
            {/* Left Settings (5 cols) - Streamlined for restaurant owners */}
            <div className="lg:col-span-5 space-y-5">
              {/* Card 1: Live Menu & Cloud Sync */}
              <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Globe size={16} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm">Live Digital Menu</h3>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">Online menu for customer mobile phones</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Live & Active</span>
                  </span>
                </div>

                {/* Live Menu URL Bar */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Menu Web Address
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-mono text-blue-700 dark:text-blue-300 truncate font-semibold">
                      {activeTargetUrl}
                    </code>
                    <button
                      type="button"
                      onClick={copyUrl}
                      className="px-3 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-xl text-xs flex items-center gap-1 transition"
                    >
                      {copiedUrl ? <Check size={14} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={14} />}
                      <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Customer Menu Slug (Collision-Proof License Key Suffix) */}
                <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Customer Path Slug
                    </label>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Collision-Proof (License Key)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-mono text-gray-500 dark:text-gray-400 font-semibold">
                      /m/
                    </span>
                    <input
                      type="text"
                      value={customerSlug}
                      onChange={(e) => setCustomerSlug(e.target.value)}
                      placeholder="e.g. kapil-cafe-slxfi"
                      className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-mono text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                    />
                    <button
                      type="button"
                      onClick={handleSaveSettings}
                      className="px-3 py-2 bg-gray-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition"
                    >
                      Save
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    License key suffix guarantees distinct URLs if multiple restaurants share the same name.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleSyncToCloud}
                    disabled={syncingCloud}
                    className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                  >
                    <UploadCloud size={14} className={syncingCloud ? 'animate-bounce' : ''} />
                    <span>{syncingCloud ? 'Syncing...' : 'Sync Menu Now'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.open(activeTargetUrl, '_blank')}
                    className="py-2.5 px-3 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                  >
                    <ExternalLink size={14} className="text-blue-600 dark:text-blue-400" />
                    <span>Open Web Menu</span>
                  </button>
                </div>

                {lastSyncTime && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
                    Last synchronized to cloud at {lastSyncTime}
                  </p>
                )}
              </div>

              {/* Card 2: Guest Wi-Fi Setup */}
              <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Wifi size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">Guest Wi-Fi (Optional)</h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Shown to guests when viewing the menu</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Wi-Fi Name (SSID)
                    </label>
                    <input
                      type="text"
                      value={wifiSsid}
                      onChange={(e) => setWifiSsid(e.target.value)}
                      placeholder="e.g. Cafe_Guest"
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl text-xs text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Wi-Fi Password
                    </label>
                    <input
                      type="text"
                      value={wifiPassword}
                      onChange={(e) => setWifiPassword(e.target.value)}
                      placeholder="e.g. welcome123"
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl text-xs text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="w-full py-2 bg-gray-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition"
                >
                  Save Wi-Fi Settings
                </button>
              </div>
            </div>

            {/* Right Customer Menu View (7 cols) */}
            <div className="lg:col-span-7 flex flex-col items-center">
              <div className="w-full flex flex-col items-center">
                <div className="text-center mb-3">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Interactive Customer Preview
                  </span>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Live viewport simulation of customer's device</p>
                </div>

                {/* Device Selector */}
                <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-2 border border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('tablet')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      previewDevice === 'tablet'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Tablet size={13} className="text-amber-500" />
                    <span>Digital Menu Board (Tablet)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('phone')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      previewDevice === 'phone'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Smartphone size={13} className="text-blue-500" />
                    <span>Mobile Phone</span>
                  </button>
                </div>

                {/* Pan Controls & Tip */}
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => tabletScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' })}
                    className="flex items-center gap-1 px-3 py-1 bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold shadow-sm transition"
                    title="Pan to Left Column"
                  >
                    <span>◀ Left Column</span>
                  </button>
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-amber-500 font-semibold bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                    <span>💡 Scroll or drag with mouse to pan between columns</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => tabletScrollRef.current?.scrollTo({ left: 450, behavior: 'smooth' })}
                    className="flex items-center gap-1 px-3 py-1 bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold shadow-sm transition"
                    title="Pan to Right Column"
                  >
                    <span>Right Column ▶</span>
                  </button>
                </div>

                {previewDevice === 'tablet' ? (
                  /* Tablet / Digital Menu Board Mockup */
                  <div className="relative mx-auto border-[12px] border-slate-200 dark:border-slate-800 rounded-[32px] overflow-hidden shadow-2xl bg-[#070b14] w-full max-w-4xl h-[640px] flex flex-col">
                    {/* Tablet Top Camera Dot */}
                    <div className="w-2.5 h-2.5 bg-slate-400 dark:bg-slate-600 rounded-full mx-auto my-1.5 shrink-0" />

                    {/* Customer Menu Running inside Mockup with styled scrollbars */}
                    <div
                      ref={tabletScrollRef}
                      className="flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-auto preview-scroll cursor-grab active:cursor-grabbing"
                    >
                      {menuData && <CustomerMenu initialData={menuData} previewMode />}
                    </div>
                  </div>
                ) : (
                  /* Smartphone Device Frame */
                  <div className="relative mx-auto border-[10px] border-slate-900 dark:border-slate-800 rounded-[44px] overflow-hidden shadow-2xl bg-[#070b14] w-full max-w-sm aspect-[9/19] max-h-[680px]">
                    {/* Speaker Notch */}
                    <div className="absolute top-0 inset-x-0 h-6 bg-slate-900 dark:bg-slate-800 z-50 flex items-center justify-center">
                      <div className="w-16 h-3.5 bg-slate-950 dark:bg-slate-900 rounded-b-xl" />
                    </div>

                    {/* Customer Menu Running inside Mockup with styled scrollbars */}
                    <div className="h-full overflow-x-auto overflow-y-auto pt-6 preview-scroll">
                      {menuData && <CustomerMenu initialData={menuData} previewMode />}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QrMenuStudio;
