import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Banknote,
  CreditCard,
  Smartphone,
  CheckCircle2,
  Receipt,
  Phone,
  Coins,
  MessageCircle,
  ArrowRightLeft,
  AlertCircle,
  Check,
  RotateCcw,
  Plus,
} from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { formatCurrency } from '../../lib/formatters';
import { currencySymbolForLanguage } from '../../lib/currencyLocale';
import { ipc } from '../../lib/ipc';
import { useTranslation } from 'react-i18next';
import { useBillingStore } from '../../stores/billing.store';
import { useSettings } from '../../hooks/useSettings';
import { WHATSAPP_FEATURE_ENABLED } from '../../../shared/featureFlags';
import toast from 'react-hot-toast';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (
    payments: PaymentEntry[],
    tip: number,
    printBill: boolean,
    customer?: { phone: string },
    sendWhatsApp?: boolean,
    coinsToRedeem?: number
  ) => void;
  isProcessing?: boolean;
}

interface PaymentEntry {
  mode: 'cash' | 'card' | 'upi';
  amount: number; // in paise
  reference?: string;
}

interface CoinSlab {
  minAmount: number;
  coins: number;
}

type ActivePaymentMode = 'cash' | 'card' | 'upi' | 'split';

/**
 * Calculates quick round cash note chips based on bill amount.
 */
function getQuickCashOptions(totalPaise: number): number[] {
  const totalRupees = Math.ceil(totalPaise / 100);
  if (totalRupees <= 0) return [0];

  const set = new Set<number>();
  set.add(totalRupees);

  if (totalRupees % 10 !== 0) {
    set.add(Math.ceil(totalRupees / 10) * 10);
  }
  if (totalRupees % 50 !== 0) {
    set.add(Math.ceil(totalRupees / 50) * 50);
  }
  if (totalRupees % 100 !== 0) {
    set.add(Math.ceil(totalRupees / 100) * 100);
  }

  const standardNotes = [50, 100, 200, 500, 1000, 2000];
  for (const note of standardNotes) {
    if (note > totalRupees) {
      set.add(note);
    }
  }

  return Array.from(set).sort((a, b) => a - b).slice(0, 5);
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  isProcessing = false,
}) => {
  const { t, i18n } = useTranslation();
  const { settings } = useSettings();
  const tipsEnabled = String(settings.enable_tips ?? 'true') !== 'false';

  const getSubtotal = useBillingStore((s) => s.getSubtotal);
  const getDiscountAmount = useBillingStore((s) => s.getDiscountAmount);
  const getTaxBreakdown = useBillingStore((s) => s.getTaxBreakdown);
  const getGrandTotal = useBillingStore((s) => s.getGrandTotal);

  const subtotal = getSubtotal();
  const discountAmount = getDiscountAmount();
  const taxBreakdown = getTaxBreakdown();
  const totalTax = taxBreakdown.reduce((sum, row) => sum + row.total, 0);
  const grandTotal = getGrandTotal();

  const [activeMode, setActiveMode] = useState<ActivePaymentMode>('cash');
  const [reference, setReference] = useState('');
  const [referenceError, setReferenceError] = useState('');
  const [tipInput, setTipInput] = useState('');
  const [printBill, setPrintBill] = useState(true);

  // Cash Tender State
  const [cashTenderedInput, setCashTenderedInput] = useState('');
  const cashInputRef = useRef<HTMLInputElement>(null);

  // Split Tender State
  const [splitCash, setSplitCash] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [splitUpi, setSplitUpi] = useState('');
  const [splitCardRef, setSplitCardRef] = useState('');
  const [splitUpiRef, setSplitUpiRef] = useState('');

  // Customer & CRM State
  const [customerPhone, setCustomerPhone] = useState('');
  const [phoneSuggestions, setPhoneSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCustomerInfo, setSelectedCustomerInfo] = useState<any>(null);
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const phoneDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Coin state
  const [coinsEnabled, setCoinsEnabled] = useState(false);
  const [coinSlabs, setCoinSlabs] = useState<CoinSlab[]>([]);
  const [redeemCoins, setRedeemCoins] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState('');

  // WhatsApp state
  const [whatsappAvailable, setWhatsappAvailable] = useState(false);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setCustomerPhone('');
      setPhoneSuggestions([]);
      setShowSuggestions(false);
      setSelectedCustomerInfo(null);
      setDropdownStyle(null);
      setRedeemCoins(false);
      setRedeemAmount('');
      setSendWhatsApp(false);
      setCashTenderedInput('');
      setSplitCash('');
      setSplitCard('');
      setSplitUpi('');
      setSplitCardRef('');
      setSplitUpiRef('');
      setReference('');
      setReferenceError('');
      setTipInput('');
      setActiveMode('cash');

      Promise.all([
        ipc<string | null>(window.electronAPI.settings.get('coins_enabled')),
        ipc<string | null>(window.electronAPI.settings.get('coin_slabs')),
        ipc<string | null>(window.electronAPI.settings.get('whatsapp_enabled')),
        ipc<string | null>(window.electronAPI.settings.get('chatmitra_api_key')),
      ])
        .then(([coinsVal, slabsVal, waEnabled, waKey]) => {
          setCoinsEnabled(coinsVal === 'true');
          setWhatsappAvailable(WHATSAPP_FEATURE_ENABLED && waEnabled === 'true' && !!waKey);
          try {
            const parsed = slabsVal ? JSON.parse(slabsVal) : [];
            setCoinSlabs(Array.isArray(parsed) ? parsed : []);
          } catch {
            setCoinSlabs([]);
          }
        })
        .catch(() => {
          setCoinsEnabled(false);
          setWhatsappAvailable(false);
        });

      // Auto-focus cash tender input when opening modal
      setTimeout(() => {
        cashInputRef.current?.focus();
        cashInputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  // Compute dropdown position after suggestions appear
  useEffect(() => {
    if (showSuggestions && phoneSuggestions.length > 0 && phoneInputRef.current) {
      const rect = phoneInputRef.current.getBoundingClientRect();
      setDropdownStyle({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    } else {
      setDropdownStyle(null);
    }
  }, [showSuggestions, phoneSuggestions]);

  // Debounced search for customer phone
  useEffect(() => {
    if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
    if (customerPhone.length < 3) {
      setPhoneSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    phoneDebounceRef.current = setTimeout(() => {
      ipc<any[]>(window.electronAPI.customers.search(customerPhone))
        .then((results) => {
          setPhoneSuggestions(results ?? []);
          setShowSuggestions((results ?? []).length > 0);
        })
        .catch(() => {
          setPhoneSuggestions([]);
          setShowSuggestions(false);
        });
    }, 300);
    return () => {
      if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
    };
  }, [customerPhone]);

  // Reset coin redemption when customer changes
  useEffect(() => {
    setRedeemCoins(false);
    setRedeemAmount('');
  }, [selectedCustomerInfo]);

  const tip = useMemo(() => {
    const val = parseFloat(tipInput);
    return isNaN(val) ? 0 : Math.round(val * 100);
  }, [tipInput]);

  // Coin calculations
  const customerCoins = selectedCustomerInfo?.loyaltyPoints ?? 0;
  const grandTotalRupees = grandTotal / 100;
  const maxRedeemable = Math.min(customerCoins, Math.floor(grandTotalRupees));

  const parsedRedeemAmount = useMemo(() => {
    if (!redeemCoins) return 0;
    const val = parseInt(redeemAmount, 10);
    if (isNaN(val) || val <= 0) return 0;
    return Math.min(val, maxRedeemable);
  }, [redeemCoins, redeemAmount, maxRedeemable]);

  const coinDiscountPaise = parsedRedeemAmount * 100;
  const totalWithTip = Math.max(0, grandTotal + tip - coinDiscountPaise);
  const totalRupees = totalWithTip / 100;

  const coinsWillEarn = useMemo(() => {
    if (!coinsEnabled || coinSlabs.length === 0) return 0;
    const billRupees = grandTotal / 100;
    let earned = 0;
    for (const slab of coinSlabs) {
      if (billRupees >= slab.minAmount) earned = slab.coins;
    }
    return earned;
  }, [coinsEnabled, coinSlabs, grandTotal]);

  // Cash Tender & Change Calculations
  const quickCashOptions = useMemo(() => getQuickCashOptions(totalWithTip), [totalWithTip]);

  const effectiveCashTenderedRupees = useMemo(() => {
    if (cashTenderedInput.trim() === '') return totalRupees;
    const val = parseFloat(cashTenderedInput);
    return isNaN(val) ? 0 : val;
  }, [cashTenderedInput, totalRupees]);

  const cashTenderedPaise = Math.round(effectiveCashTenderedRupees * 100);
  const changePaise = cashTenderedPaise - totalWithTip;
  const isCashUnderpaid = cashTenderedInput.trim() !== '' && cashTenderedPaise < totalWithTip;

  // Split Tender Calculations
  const splitCashPaise = Math.round((parseFloat(splitCash) || 0) * 100);
  const splitCardPaise = Math.round((parseFloat(splitCard) || 0) * 100);
  const splitUpiPaise = Math.round((parseFloat(splitUpi) || 0) * 100);
  const totalSplitAllocated = splitCashPaise + splitCardPaise + splitUpiPaise;
  const splitRemainingPaise = totalWithTip - totalSplitAllocated;

  const handleFillRemaining = (mode: 'cash' | 'card' | 'upi') => {
    if (splitRemainingPaise <= 0) return;
    const remainingRupees = (splitRemainingPaise / 100).toFixed(2);
    if (mode === 'cash') setSplitCash(String(parseFloat(splitCash || '0') + parseFloat(remainingRupees)));
    if (mode === 'card') setSplitCard(String(parseFloat(splitCard || '0') + parseFloat(remainingRupees)));
    if (mode === 'upi') setSplitUpi(String(parseFloat(splitUpi || '0') + parseFloat(remainingRupees)));
  };

  const cs = currencySymbolForLanguage(i18n.language);

  const handleComplete = useCallback(() => {
    if (isProcessing) return;

    // Validate phone length if entered
    const phone = customerPhone.trim();
    if (phone && phone.length !== 10) return;

    const customer = phone ? { phone } : undefined;

    if (activeMode === 'split') {
      if (splitRemainingPaise > 0) {
        toast.error(t('paymentModal.splitIncomplete', 'Please allocate the remaining balance'));
        return;
      }
      if (splitRemainingPaise < 0) {
        toast.error(t('paymentModal.splitOverAllocated', 'Total payment exceeds amount due'));
        return;
      }

      const entries: PaymentEntry[] = [];
      if (splitCashPaise > 0) entries.push({ mode: 'cash', amount: splitCashPaise });
      if (splitCardPaise > 0) entries.push({ mode: 'card', amount: splitCardPaise, reference: splitCardRef.trim() || undefined });
      if (splitUpiPaise > 0) entries.push({ mode: 'upi', amount: splitUpiPaise, reference: splitUpiRef.trim() || undefined });

      onComplete(
        entries,
        tip,
        printBill,
        customer,
        sendWhatsApp && whatsappAvailable ? true : undefined,
        parsedRedeemAmount > 0 ? parsedRedeemAmount : undefined
      );
      return;
    }

    // Cash mode validation
    if (activeMode === 'cash') {
      if (isCashUnderpaid) {
        toast.error(t('paymentModal.underpaidError', 'Cash received is less than total bill'));
        return;
      }

      const entry: PaymentEntry = {
        mode: 'cash',
        amount: totalWithTip,
        reference:
          changePaise > 0
            ? `Received: ${formatCurrency(cashTenderedPaise)} | Change: ${formatCurrency(changePaise)}`
            : undefined,
      };

      onComplete(
        [entry],
        tip,
        printBill,
        customer,
        sendWhatsApp && whatsappAvailable ? true : undefined,
        parsedRedeemAmount > 0 ? parsedRedeemAmount : undefined
      );

      if (changePaise > 0) {
        toast.success(
          t('paymentModal.changeNotice', {
            amount: formatCurrency(changePaise),
            defaultValue: `Return ${formatCurrency(changePaise)} change`,
          }),
          { duration: 5000, icon: '💵' }
        );
      }
      return;
    }

    // Single Card / UPI
    const entry: PaymentEntry = {
      mode: activeMode,
      amount: totalWithTip,
      reference: reference.trim() || undefined,
    };

    onComplete(
      [entry],
      tip,
      printBill,
      customer,
      sendWhatsApp && whatsappAvailable ? true : undefined,
      parsedRedeemAmount > 0 ? parsedRedeemAmount : undefined
    );
  }, [
    activeMode,
    totalWithTip,
    reference,
    tip,
    printBill,
    onComplete,
    customerPhone,
    parsedRedeemAmount,
    sendWhatsApp,
    whatsappAvailable,
    isProcessing,
    splitRemainingPaise,
    splitCashPaise,
    splitCardPaise,
    splitUpiPaise,
    splitCardRef,
    splitUpiRef,
    isCashUnderpaid,
    changePaise,
    cashTenderedPaise,
    t,
  ]);

  const handleClose = useCallback(() => {
    setReference('');
    setReferenceError('');
    setTipInput('');
    setCashTenderedInput('');
    setActiveMode('cash');
    onClose();
  }, [onClose]);

  const paymentModes = useMemo(
    () => [
      { key: 'cash' as const, label: t('paymentModal.cash', 'Cash'), icon: Banknote, color: 'bg-emerald-600 hover:bg-emerald-700' },
      { key: 'card' as const, label: t('paymentModal.card', 'Card'), icon: CreditCard, color: 'bg-blue-600 hover:bg-blue-700' },
      { key: 'upi' as const, label: t('paymentModal.upi', 'UPI / QR'), icon: Smartphone, color: 'bg-purple-600 hover:bg-purple-700' },
      { key: 'split' as const, label: t('paymentModal.split', 'Split'), icon: ArrowRightLeft, color: 'bg-indigo-600 hover:bg-indigo-700' },
    ],
    [t]
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('paymentModal.title', 'Checkout & Settlement')} size="lg" closeOnOverlay={false}>
      <div className="flex flex-col gap-3.5">
        {/* Order Summary & Net Payable Banner */}
        <div className="bg-gray-50 dark:bg-gray-800/90 border border-gray-200/80 dark:border-gray-700 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-gray-200/60 dark:border-gray-700">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Net Amount Due
              </span>
              <div className="text-2xl font-black text-gray-900 dark:text-white tracking-tight font-mono">
                {formatCurrency(totalWithTip)}
              </div>
            </div>

            <div className="text-right text-xs space-y-0.5 text-gray-500 dark:text-gray-400">
              <div className="flex justify-end gap-3">
                <span>{t('paymentModal.subtotal', 'Subtotal')}:</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-end gap-3 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span>{t('paymentModal.discount', 'Discount')}:</span>
                  <span>- {formatCurrency(discountAmount)}</span>
                </div>
              )}
              {totalTax > 0 && (
                <div className="flex justify-end gap-3">
                  <span>{t('paymentModal.tax', 'Tax')}:</span>
                  <span>{formatCurrency(totalTax)}</span>
                </div>
              )}
              {parsedRedeemAmount > 0 && (
                <div className="flex justify-end gap-3 text-amber-600 dark:text-amber-400 font-medium">
                  <span>Coins:</span>
                  <span>- {cs}{parsedRedeemAmount}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Tip Row (if enabled) */}
          {tipsEnabled && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t('paymentModal.addTipOptional', 'Staff Tip (Optional)')}:
              </span>
              <div className="flex items-center gap-1.5">
                {[
                  { label: 'None', val: 0 },
                  { label: `${cs}20`, val: 20 },
                  { label: `${cs}50`, val: 50 },
                  { label: `${cs}100`, val: 100 },
                ].map((chip) => {
                  const isSelected = tipInput === (chip.val > 0 ? String(chip.val) : '');
                  return (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => setTipInput(chip.val > 0 ? String(chip.val) : '')}
                      className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
                <div className="relative w-20">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{cs}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={tipInput}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9.]/g, '');
                      setTipInput(v);
                    }}
                    placeholder="Custom"
                    className="w-full pl-5 pr-1.5 py-0.5 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Payment Mode Segmented Selector */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5 block">
            {t('paymentModal.paymentMode', 'Payment Mode')}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {paymentModes.map(({ key, label, icon: Icon, color }) => {
              const isSelected = activeMode === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setActiveMode(key);
                    setReferenceError('');
                    if (key === 'cash') {
                      setTimeout(() => cashInputRef.current?.focus(), 50);
                    }
                  }}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl transition-all border font-semibold ${
                    isSelected
                      ? `${color} text-white shadow-sm ring-2 ring-blue-500/30 scale-[1.02]`
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-xs leading-none">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* =========================================================================
            CASH PAYMENT & CHANGE RETURN
        ========================================================================= */}
        {activeMode === 'cash' && (
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/80 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                <Banknote size={15} className="text-emerald-600" />
                <span>Cash Received from Customer</span>
              </label>

              {cashTenderedInput.trim() !== '' && (
                <button
                  type="button"
                  onClick={() => setCashTenderedInput('')}
                  className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <RotateCcw size={11} />
                  <span>Reset to Exact</span>
                </button>
              )}
            </div>

            {/* Quick Cash Denomination Chips */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1.5">
                {quickCashOptions.map((amount) => {
                  const isExact = amount === totalRupees;
                  const isSelected = parseFloat(cashTenderedInput) === amount || (cashTenderedInput === '' && isExact);
                  return (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setCashTenderedInput(String(amount))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs scale-105'
                          : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50'
                      }`}
                    >
                      {isExact ? `Exact (${cs}${amount})` : `${cs}${amount}`}
                    </button>
                  );
                })}
              </div>

              {/* Quick Increments */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Add:</span>
                {[50, 100, 500].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => {
                      const cur = parseFloat(cashTenderedInput) || totalRupees;
                      setCashTenderedInput(String(cur + inc));
                    }}
                    className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100/70 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-200 transition-colors"
                  >
                    +{cs}{inc}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash Tendered Input Field */}
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-700 dark:text-emerald-300 font-bold text-base">
                {cs}
              </span>
              <input
                ref={cashInputRef}
                type="text"
                inputMode="decimal"
                value={cashTenderedInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, '');
                  setCashTenderedInput(val);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleComplete();
                }}
                placeholder={String(totalRupees)}
                className="w-full pl-9 pr-4 py-2 text-base font-bold bg-white dark:bg-gray-900 border border-emerald-300 dark:border-emerald-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner font-mono"
              />
            </div>

            {/* LIVE CHANGE RETURN BANNER */}
            {changePaise > 0 ? (
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl p-3 flex items-center justify-between shadow-xs animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                    <Banknote size={20} />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-100">
                      Change to Return
                    </p>
                    <p className="text-xs text-white/90 font-medium">
                      Cash received: {cs}{effectiveCashTenderedRupees}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black font-mono tracking-tight">
                    {formatCurrency(changePaise)}
                  </span>
                </div>
              </div>
            ) : isCashUnderpaid ? (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl p-3 flex items-center justify-between text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-2">
                  <AlertCircle size={18} className="text-amber-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold">Cash Received is Not Enough</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">Amount given is less than total bill</p>
                  </div>
                </div>
                <span className="text-base font-bold font-mono text-amber-700 dark:text-amber-300">
                  Short by {formatCurrency(-changePaise)}
                </span>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <span>Exact Cash Received</span>
                </div>
                <span className="font-mono font-bold">{formatCurrency(cashTenderedPaise)}</span>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            SPLIT PAYMENT (MULTI-PAYMENT)
        ========================================================================= */}
        {activeMode === 'split' && (
          <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">Split Payment Breakdown</h5>
                <p className="text-[11px] text-gray-500">Divide bill payment across Cash, Card, and UPI</p>
              </div>

              <div className="text-right">
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    splitRemainingPaise === 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : splitRemainingPaise > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {splitRemainingPaise === 0
                    ? 'Fully Allocated ✓'
                    : splitRemainingPaise > 0
                    ? `Remaining: ${formatCurrency(splitRemainingPaise)}`
                    : `Over by: ${formatCurrency(-splitRemainingPaise)}`}
                </span>
              </div>
            </div>

            {/* Split Lines */}
            <div className="space-y-2">
              {/* Cash Portion */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Banknote size={15} />
                </div>
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 w-16">Cash:</span>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{cs}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={splitCash}
                    onChange={(e) => setSplitCash(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    className="w-full pl-6 pr-2 py-1 text-xs font-mono font-bold border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                {splitRemainingPaise > 0 && (
                  <button
                    type="button"
                    onClick={() => handleFillRemaining('cash')}
                    className="px-2 py-1 text-[10px] font-semibold rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                  >
                    + Fill
                  </button>
                )}
              </div>

              {/* Card Portion */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <CreditCard size={15} />
                </div>
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 w-16">Card:</span>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{cs}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={splitCard}
                    onChange={(e) => setSplitCard(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    className="w-full pl-6 pr-2 py-1 text-xs font-mono font-bold border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <input
                  type="text"
                  maxLength={4}
                  value={splitCardRef}
                  onChange={(e) => setSplitCardRef(e.target.value)}
                  placeholder="Last 4"
                  className="w-16 px-2 py-1 text-[11px] border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
                {splitRemainingPaise > 0 && (
                  <button
                    type="button"
                    onClick={() => handleFillRemaining('card')}
                    className="px-2 py-1 text-[10px] font-semibold rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                  >
                    + Fill
                  </button>
                )}
              </div>

              {/* UPI Portion */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Smartphone size={15} />
                </div>
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 w-16">UPI:</span>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{cs}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={splitUpi}
                    onChange={(e) => setSplitUpi(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    className="w-full pl-6 pr-2 py-1 text-xs font-mono font-bold border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <input
                  type="text"
                  value={splitUpiRef}
                  onChange={(e) => setSplitUpiRef(e.target.value)}
                  placeholder="UTR ref"
                  className="w-20 px-2 py-1 text-[11px] border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
                {splitRemainingPaise > 0 && (
                  <button
                    type="button"
                    onClick={() => handleFillRemaining('upi')}
                    className="px-2 py-1 text-[10px] font-semibold rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                  >
                    + Fill
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Card or UPI Reference Inputs (Single Mode) */}
        {(activeMode === 'card' || activeMode === 'upi') && (
          <div className="bg-gray-50 dark:bg-gray-850 p-3 rounded-xl border border-gray-200 dark:border-gray-700 space-y-1.5">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              {activeMode === 'card' ? <CreditCard size={14} className="text-blue-600" /> : <Smartphone size={14} className="text-purple-600" />}
              <span>{activeMode === 'card' ? t('paymentModal.cardLast4', 'Card Last 4 Digits (Optional)') : t('paymentModal.transactionId', 'UPI Reference / UTR Number')}</span>
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
                setReferenceError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleComplete();
              }}
              placeholder={activeMode === 'card' ? '1234' : 'Enter 12-digit UTR or Reference Number'}
              maxLength={activeMode === 'card' ? 4 : 30}
              className={`w-full px-3 py-1.5 text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                referenceError ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
              }`}
            />
          </div>
        )}

        {/* Customer Phone (Optional) with Autocomplete */}
        <div className="border-t border-gray-200/80 dark:border-gray-700 pt-3">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
            <span>{t('paymentModal.customerPhoneOptional', 'Customer Mobile (for Loyalty & WhatsApp)')}</span>
            {selectedCustomerInfo && (
              <span className="text-[11px] font-normal text-blue-600 dark:text-blue-400">
                {selectedCustomerInfo.name}
              </span>
            )}
          </label>
          <div className="relative">
            <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={phoneInputRef}
              type="tel"
              value={customerPhone}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setCustomerPhone(val);
                setSelectedCustomerInfo(null);
              }}
              onFocus={() => {
                if (phoneSuggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder={t('paymentModal.phonePlaceholder', 'Search 10-digit mobile number...')}
              maxLength={10}
              className={`w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                customerPhone.length > 0 && customerPhone.length < 10
                  ? 'border-red-400'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
          </div>

          {customerPhone.length > 0 && customerPhone.length < 10 && (
            <p className="text-[11px] text-red-500 mt-1">Phone number must be exactly 10 digits</p>
          )}

          {/* Autocomplete Dropdown */}
          {dropdownStyle && phoneSuggestions.length > 0 && (
            <>
              <div className="fixed inset-0 z-[60]" onClick={() => setShowSuggestions(false)} />
              <div
                className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-[61] max-h-48 overflow-y-auto"
                style={{ top: dropdownStyle.top, left: dropdownStyle.left, width: dropdownStyle.width }}
              >
                {phoneSuggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCustomerPhone(c.phone ?? '');
                      setSelectedCustomerInfo(c);
                      setShowSuggestions(false);
                      setDropdownStyle(null);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-gray-750 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{c.name}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">{c.phone}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 shrink-0">
                      <span className="flex items-center gap-1 font-semibold text-amber-600">
                        <Coins size={11} className="text-yellow-500" />
                        {c.loyaltyPoints ?? 0}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Loyalty Coins Redemption (When applicable) */}
        {coinsEnabled && selectedCustomerInfo && customerCoins > 0 && (
          <div className="bg-yellow-50/80 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-2.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-yellow-900 dark:text-yellow-200">
              <span className="flex items-center gap-1.5">
                <Coins size={14} className="text-yellow-600" />
                <span>{customerCoins} Coins Available ({cs}{customerCoins})</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setRedeemCoins(!redeemCoins);
                  if (!redeemCoins) setRedeemAmount(String(maxRedeemable));
                  else setRedeemAmount('');
                }}
                className="text-xs font-bold text-yellow-700 dark:text-yellow-300 hover:underline"
              >
                {redeemCoins ? 'Remove' : 'Redeem as Discount'}
              </button>
            </div>

            {redeemCoins && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="number"
                  min="1"
                  max={maxRedeemable}
                  value={redeemAmount}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setRedeemAmount(val);
                  }}
                  placeholder={`Max ${maxRedeemable}`}
                  className="w-full px-2.5 py-1 text-xs border border-yellow-300 rounded-md bg-white dark:bg-gray-800 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setRedeemAmount(String(maxRedeemable))}
                  className="px-2.5 py-1 text-[11px] font-bold rounded bg-yellow-200 dark:bg-yellow-900/60 text-yellow-900 dark:text-yellow-100 shrink-0"
                >
                  Use Max ({maxRedeemable})
                </button>
              </div>
            )}
          </div>
        )}

        {/* Post-Settlement Toggles (Receipt & WhatsApp) */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={printBill}
              onChange={(e) => setPrintBill(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="flex items-center gap-1.5">
              <Receipt size={13} />
              <span>{t('paymentModal.printBillAfter', 'Print Thermal Bill')}</span>
            </span>
          </label>

          {whatsappAvailable && customerPhone.length === 10 && (
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <input
                type="checkbox"
                checked={sendWhatsApp}
                onChange={(e) => setSendWhatsApp(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="flex items-center gap-1.5">
                <MessageCircle size={13} />
                <span>Send via WhatsApp</span>
              </span>
            </label>
          )}
        </div>

        {/* Complete Payment Button */}
        <Button
          variant="success"
          size="lg"
          icon={<CheckCircle2 size={18} />}
          onClick={handleComplete}
          fullWidth
          disabled={
            (customerPhone.length > 0 && customerPhone.length < 10) ||
            isProcessing ||
            (activeMode === 'cash' && isCashUnderpaid) ||
            (activeMode === 'split' && splitRemainingPaise !== 0)
          }
          loading={isProcessing}
          className="py-3 shadow-md font-bold text-sm"
        >
          {isProcessing
            ? t('paymentModal.processing', 'Processing Payment...')
            : activeMode === 'cash'
            ? changePaise > 0
              ? `Complete Payment • Return ${formatCurrency(changePaise)}`
              : `Complete Cash Payment • ${formatCurrency(totalWithTip)}`
            : activeMode === 'split'
            ? splitRemainingPaise === 0
              ? `Complete Split Payment • ${formatCurrency(totalWithTip)}`
              : `Allocate Remaining ${formatCurrency(splitRemainingPaise)}`
            : activeMode === 'card'
            ? `Charge Card • ${formatCurrency(totalWithTip)}`
            : `Verify & Settle • ${formatCurrency(totalWithTip)}`}
        </Button>
      </div>
    </Modal>
  );
};

export default PaymentModal;
