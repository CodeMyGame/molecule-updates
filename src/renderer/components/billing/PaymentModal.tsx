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

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (payments: PaymentEntry[], tip: number, printBill: boolean, customer?: { phone: string }, sendWhatsApp?: boolean, coinsToRedeem?: number) => void;
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

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onComplete }) => {
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

  const paymentModes = useMemo(
    () =>
      [
        { key: 'cash' as const, label: t('paymentModal.cash'), icon: Banknote, color: 'bg-green-600 hover:bg-green-700' },
        { key: 'card' as const, label: t('paymentModal.card'), icon: CreditCard, color: 'bg-blue-600 hover:bg-blue-700' },
        { key: 'upi' as const, label: t('paymentModal.upi'), icon: Smartphone, color: 'bg-purple-600 hover:bg-purple-700' },
      ],
    [t, i18n.language]
  );
  const grandTotal = getGrandTotal();

  const [activeMode, setActiveMode] = useState<'cash' | 'card' | 'upi'>('cash');
  const [reference, setReference] = useState('');
  const [referenceError, setReferenceError] = useState('');
  const [tipInput, setTipInput] = useState('');
  const [printBill, setPrintBill] = useState(true);
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

  // Reset state each time the modal opens
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
          } catch { setCoinSlabs([]); }
        })
        .catch(() => {
          setCoinsEnabled(false);
          setWhatsappAvailable(false);
        });
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
    return () => { if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current); };
  }, [customerPhone]);

  // Reset coin redemption when customer changes
  useEffect(() => {
    setRedeemCoins(false);
    setRedeemAmount('');
  }, [selectedCustomerInfo]);

  const tip = useMemo(() => {
    const val = parseFloat(tipInput);
    return isNaN(val) ? 0 : Math.round(val * 100); // convert to paise
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
  const totalWithTip = grandTotal + tip - coinDiscountPaise;

  const coinsWillEarn = useMemo(() => {
    if (!coinsEnabled || coinSlabs.length === 0) return 0;
    const billRupees = grandTotal / 100;
    let earned = 0;
    for (const slab of coinSlabs) {
      if (billRupees >= slab.minAmount) earned = slab.coins;
    }
    return earned;
  }, [coinsEnabled, coinSlabs, grandTotal]);

  const handleComplete = useCallback(() => {
    // Validate phone length if entered
    const phone = customerPhone.trim();
    if (phone && phone.length !== 10) return; // blocked by inline error, don't proceed

    const customer = phone ? { phone } : undefined;

    const entry: PaymentEntry = {
      mode: activeMode,
      amount: totalWithTip,
      reference: reference.trim() || undefined,
    };
    onComplete([entry], tip, printBill, customer, sendWhatsApp && whatsappAvailable ? true : undefined, parsedRedeemAmount > 0 ? parsedRedeemAmount : undefined);
  }, [activeMode, totalWithTip, reference, tip, printBill, onComplete, customerPhone, parsedRedeemAmount, sendWhatsApp, whatsappAvailable]);

  const handleClose = useCallback(() => {
    setReference('');
    setReferenceError('');
    setTipInput('');
    setActiveMode('cash');
    onClose();
  }, [onClose]);

  const cs = currencySymbolForLanguage(i18n.language);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('paymentModal.title')} size="md" closeOnOverlay={false}>
      <div className="flex flex-col gap-3">
        {/* Order summary */}
        <div className="bg-gray-50 rounded-lg px-3 py-2 space-y-1">
          <div className="flex justify-between text-xs text-gray-600">
            <span>{t('paymentModal.subtotal')}</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-xs text-green-600">
              <span>{t('paymentModal.discount')}</span>
              <span>- {formatCurrency(discountAmount)}</span>
            </div>
          )}
          {totalTax > 0 && (
            <div className="flex justify-between text-xs text-gray-600">
              <span>{t('paymentModal.tax')}</span>
              <span>{formatCurrency(totalTax)}</span>
            </div>
          )}
          {tip > 0 && (
            <div className="flex justify-between text-xs text-gray-600">
              <span>{t('paymentModal.tip')}</span>
              <span>{formatCurrency(tip)}</span>
            </div>
          )}
          {parsedRedeemAmount > 0 && (
            <div className="flex justify-between text-xs text-yellow-600">
              <span>{t('paymentModal.coinRedemption', { count: parsedRedeemAmount })}</span>
              <span>- {cs}{parsedRedeemAmount}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-200">
            <span>{t('paymentModal.total')}</span>
            <span>{formatCurrency(totalWithTip)}</span>
          </div>
        </div>

        {/* Tip input — only shown when enable_tips is on */}
        {tipsEnabled && <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            {t('paymentModal.addTipOptional')}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
              {cs}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={tipInput}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, '');
                const parts = v.split('.');
                setTipInput(parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : v);
              }}
              placeholder={t('paymentModal.tipPlaceholder')}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>}

        {/* Payment mode selection */}
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">{t('paymentModal.paymentMode')}</label>
          <div className="grid grid-cols-3 gap-2">
            {paymentModes.map(({ key, label, icon: Icon, color }) => (
              <button
                key={key}
                onClick={() => { setActiveMode(key); setReferenceError(''); }}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg
                  transition-all text-white font-medium
                  ${
                    activeMode === key
                      ? `${color} ring-2 ring-offset-1 ring-blue-400 shadow scale-105`
                      : 'bg-gray-300 hover:bg-gray-400'
                  }`}
              >
                <Icon size={16} />
                <span className="text-xs">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Card / UPI: reference input */}
        {(activeMode === 'card' || activeMode === 'upi') && (
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              {activeMode === 'card' ? t('paymentModal.cardLast4') : t('paymentModal.transactionId')}
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => { setReference(e.target.value); setReferenceError(''); }}
              placeholder={activeMode === 'card' ? t('paymentModal.placeholderCard') : t('paymentModal.placeholderTxnId')}
              maxLength={activeMode === 'card' ? 4 : 30}
              className={`w-full px-3 py-1.5 text-xs border rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-300
                ${referenceError ? 'border-red-400' : 'border-gray-300'}`}
            />
            {referenceError && (
              <p className="text-xs text-red-500 mt-0.5">{referenceError}</p>
            )}
          </div>
        )}

        {/* Customer phone (optional) with auto-suggest */}
        <div className="border-t border-gray-200 pt-3">
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            {t('paymentModal.customerPhoneOptional')}
          </label>
          <div>
            <div className="relative">
              <Phone size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={phoneInputRef}
                type="tel"
                value={customerPhone}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setCustomerPhone(val);
                  setSelectedCustomerInfo(null);
                }}
                onFocus={() => { if (phoneSuggestions.length > 0) setShowSuggestions(true); }}
                placeholder={t('paymentModal.phonePlaceholder')}
                maxLength={10}
                className={`w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-blue-300
                  ${customerPhone.length > 0 && customerPhone.length < 10 ? 'border-red-400' : 'border-gray-300'}`}
              />
            </div>
            {customerPhone.length > 0 && customerPhone.length < 10 && (
              <p className="text-xs text-red-500 mt-1">{t('paymentModal.phoneMustBe10')}</p>
            )}

            {/* Suggestions dropdown — fixed position escapes modal overflow-y-auto clipping */}
            {dropdownStyle && phoneSuggestions.length > 0 && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setShowSuggestions(false)} />
                <div
                  className="fixed bg-white border border-gray-200 rounded-lg shadow-xl z-[61] max-h-48 overflow-y-auto"
                  style={{ top: dropdownStyle.top, left: dropdownStyle.left, width: dropdownStyle.width }}
                >
                  {phoneSuggestions.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setCustomerPhone(c.phone ?? '');
                        setSelectedCustomerInfo(c);
                        setShowSuggestions(false);
                        setDropdownStyle(null);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left
                        hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-500">{c.phone}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 flex-shrink-0">
                        <span className="flex items-center gap-1">
                          <Coins size={10} className="text-yellow-500" />
                          {c.loyaltyPoints ?? 0}
                        </span>
                        <span>{t('paymentModal.suggestionVisits', { count: c.totalVisits ?? 0 })}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Selected customer info badge */}
          {selectedCustomerInfo && (
            <div className="mt-1.5 flex items-center gap-2 px-2.5 py-1.5 bg-blue-50 rounded-lg">
              <Phone size={11} className="text-blue-600" />
              <span className="text-blue-800 font-medium text-xs">{selectedCustomerInfo.phone}</span>
              <span className="text-blue-600 text-xs">
                {t('paymentModal.customerBadge', {
                  points: selectedCustomerInfo.loyaltyPoints ?? 0,
                  visits: selectedCustomerInfo.totalVisits ?? 0,
                  spent: formatCurrency(selectedCustomerInfo.totalSpent ?? 0),
                })}
              </span>
            </div>
          )}
        </div>

        {/* Coin balance & redemption — shown when coins are enabled and customer is selected */}
        {coinsEnabled && selectedCustomerInfo && customerCoins > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <Coins size={14} className="text-yellow-600" />
              <span className="font-semibold text-yellow-800 text-xs">{t('paymentModal.coinBalance', { count: customerCoins })}</span>
              <span className="text-xs text-yellow-600">{t('paymentModal.coinEquivalent', { symbol: cs })}</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => { setRedeemCoins(!redeemCoins); if (redeemCoins) setRedeemAmount(''); }}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                  ${redeemCoins ? 'bg-yellow-600 border-yellow-600' : 'border-gray-300'}`}
              >
                {redeemCoins && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <span className="text-sm text-gray-700">{t('paymentModal.redeemAsDiscount')}</span>
            </div>

            {redeemCoins && (
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="1"
                    max={maxRedeemable}
                    value={redeemAmount}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      const num = parseInt(val, 10);
                      if (val === '') { setRedeemAmount(''); return; }
                      setRedeemAmount(String(Math.min(num, maxRedeemable)));
                    }}
                    placeholder={t('paymentModal.maxPlaceholder', { count: maxRedeemable })}
                    className="w-full px-3 py-2 border border-yellow-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-300 focus:border-yellow-500 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setRedeemAmount(String(maxRedeemable))}
                  className="px-3 py-2 text-xs font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 rounded-lg transition-colors"
                >
                  {t('paymentModal.useAll')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Coins to earn preview */}
        {coinsEnabled && coinsWillEarn > 0 && customerPhone.length === 10 && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-green-50 border border-green-200 rounded-lg">
            <Coins size={12} className="text-green-600" />
            <span className="text-xs text-green-700">
              {t('paymentModal.coinsEarnPreview', { count: coinsWillEarn })}
            </span>
          </div>
        )}

        {/* Print bill toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPrintBill(!printBill)}
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors
              ${printBill ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
          >
            {printBill && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <label className="text-xs text-gray-700 flex items-center gap-1 cursor-pointer" onClick={() => setPrintBill(!printBill)}>
            <Receipt size={12} />
            {t('paymentModal.printBillAfter')}
          </label>
        </div>

        {/* Send WhatsApp toggle */}
        {whatsappAvailable && customerPhone.length === 10 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSendWhatsApp(!sendWhatsApp)}
              className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors
                ${sendWhatsApp ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}
            >
              {sendWhatsApp && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <label className="text-xs text-gray-700 flex items-center gap-1 cursor-pointer" onClick={() => setSendWhatsApp(!sendWhatsApp)}>
              <MessageCircle size={12} className="text-green-600" />
              {t('paymentModal.sendWhatsApp')}
            </label>
          </div>
        )}

        {/* Complete button */}
        <Button
          variant="success"
          size="md"
          icon={<CheckCircle2 size={16} />}
          onClick={handleComplete}
          fullWidth
          disabled={customerPhone.length > 0 && customerPhone.length < 10}
        >
          {t('paymentModal.completePayment')}
        </Button>
      </div>
    </Modal>
  );
};

export default PaymentModal;
