import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Percent, Hash, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { formatCurrency } from '../../lib/formatters';
import { currencySymbolForLanguage } from '../../lib/currencyLocale';
import toast from 'react-hot-toast';
import { useBillingStore } from '../../stores/billing.store';
import { syncOrderDiscountToServer } from '../../lib/syncOrderDiscount';

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_PERCENTS = [5, 10, 15, 20];

const PRESET_KEYS = [
  'presetStaffMeal',
  'presetComplaint',
  'presetManager',
  'presetLoyalty',
  'presetFestival',
  'presetOther',
] as const;

const DiscountModal: React.FC<DiscountModalProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const discount = useBillingStore((s) => s.discount);
  const currentOrderId = useBillingStore((s) => s.currentOrderId);
  const applyDiscount = useBillingStore((s) => s.applyDiscount);
  const getSubtotal = useBillingStore((s) => s.getSubtotal);

  const subtotal = getSubtotal();

  const [discountType, setDiscountType] = useState<'percent' | 'flat'>(
    discount?.type ?? 'percent'
  );
  const [valueInput, setValueInput] = useState(
    discount ? String(discountType === 'flat' ? discount.value / 100 : discount.value) : ''
  );
  const [reason, setReason] = useState(discount?.reason ?? '');
  const [otherPresetActive, setOtherPresetActive] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDiscountType(discount?.type ?? 'percent');
      setValueInput(
        discount
          ? String(discount.type === 'flat' ? discount.value / 100 : discount.value)
          : ''
      );
      setReason(discount?.reason ?? '');
      setOtherPresetActive(false);
    }
  }, [isOpen, discount]);

  const presetTranslated = useMemo(
    () =>
      PRESET_KEYS.map((k) => ({
        key: k,
        label: t(`discountModal.${k}`),
      })),
    [t]
  );

  const numericValue = useMemo(() => {
    const val = parseFloat(valueInput);
    return isNaN(val) ? 0 : val;
  }, [valueInput]);

  const discountAmountPreview = useMemo(() => {
    if (numericValue <= 0) return 0;
    if (discountType === 'percent') {
      const clamped = Math.min(numericValue, 100);
      return Math.round((subtotal * clamped) / 100);
    }
    const flatPaise = Math.round(numericValue * 100);
    return Math.min(flatPaise, subtotal);
  }, [discountType, numericValue, subtotal]);

  const afterDiscount = subtotal - discountAmountPreview;

  const handleApply = useCallback(() => {
    if (numericValue <= 0) return;

    const discountInfo = {
      type: discountType,
      value: discountType === 'percent' ? Math.min(numericValue, 100) : Math.round(numericValue * 100),
      reason: reason || undefined,
    };

    applyDiscount(discountInfo);
    if (currentOrderId) {
      syncOrderDiscountToServer(currentOrderId, discountInfo).catch(() => {
        toast.error(t('discountModal.toastSaveFailed'));
      });
    }
    onClose();
  }, [discountType, numericValue, reason, applyDiscount, onClose, currentOrderId, t]);

  const handleRemove = useCallback(() => {
    applyDiscount(null);
    if (currentOrderId) {
      syncOrderDiscountToServer(currentOrderId, null).catch(() => {
        toast.error(t('discountModal.toastRemoveFailed'));
      });
    }
    onClose();
  }, [applyDiscount, onClose, currentOrderId, t]);

  const handleQuickPercent = useCallback((pct: number) => {
    setDiscountType('percent');
    setValueInput(String(pct));
  }, []);

  const isPresetSelected = (key: (typeof PRESET_KEYS)[number], label: string) => {
    if (key === 'presetOther') return otherPresetActive;
    return reason === label;
  };

  const selectPreset = (key: (typeof PRESET_KEYS)[number], label: string) => {
    if (key === 'presetOther') {
      setOtherPresetActive(true);
      setReason('');
      return;
    }
    setOtherPresetActive(false);
    setReason(label);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('discountModal.title')}
      size="md"
      footer={
        <div className="flex gap-2 w-full">
          {discount && (
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              onClick={handleRemove}
            >
              {t('discountModal.remove')}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleApply}
            disabled={numericValue <= 0 || !reason.trim()}
          >
            {t('discountModal.applyDiscount')}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">{t('discountModal.discountType')}</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setDiscountType('percent');
                setValueInput('');
              }}
              className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm
                font-medium transition-colors
                ${
                  discountType === 'percent'
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
            >
              <Percent size={18} />
              {t('discountModal.percentage')}
            </button>
            <button
              onClick={() => {
                setDiscountType('flat');
                setValueInput('');
              }}
              className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm
                font-medium transition-colors
                ${
                  discountType === 'flat'
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
            >
              <Hash size={18} />
              {t('discountModal.flatAmount')}
            </button>
          </div>
        </div>

        {discountType === 'percent' && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">{t('discountModal.quickSelect')}</label>
            <div className="grid grid-cols-4 gap-2">
              {QUICK_PERCENTS.map((pct) => (
                <button
                  key={pct}
                  onClick={() => handleQuickPercent(pct)}
                  className={`py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${
                      discountType === 'percent' && numericValue === pct
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            {discountType === 'percent' ? t('discountModal.percentageLabel') : t('discountModal.amountLabel')}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              {discountType === 'percent' ? '%' : currencySymbolForLanguage(i18n.language)}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={valueInput}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9.]/g, '');
                const parts = raw.split('.');
                const val = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : raw;
                setValueInput(val);
              }}
              placeholder={discountType === 'percent' ? '0' : '0.00'}
              className="w-full pl-8 pr-4 py-2.5 text-lg font-medium border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
              autoFocus
            />
          </div>
          {discountType === 'percent' && numericValue > 100 && (
            <p className="text-xs text-red-500 mt-1">{t('discountModal.maxPercent')}</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            {t('discountModal.reasonLabel')} <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {presetTranslated.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => selectPreset(key, label)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                  ${isPresetSelected(key, label)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={
              PRESET_KEYS.filter((k) => k !== 'presetOther').some((k) => reason === t(`discountModal.${k}`))
                ? ''
                : reason
            }
            onChange={(e) => {
              setOtherPresetActive(false);
              setReason(e.target.value);
            }}
            placeholder={t('discountModal.customReasonPlaceholder')}
            className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          {numericValue > 0 && !reason.trim() && (
            <p className="text-xs text-red-500 mt-1">{t('discountModal.reasonRequired')}</p>
          )}
        </div>

        {numericValue > 0 && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>{t('paymentModal.subtotal')}</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-green-600 font-medium">
              <span>{t('paymentModal.discount')}</span>
              <span>- {formatCurrency(discountAmountPreview)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 pt-1.5 border-t border-gray-200">
              <span>{t('discountModal.afterDiscount')}</span>
              <span>{formatCurrency(afterDiscount)}</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default DiscountModal;
