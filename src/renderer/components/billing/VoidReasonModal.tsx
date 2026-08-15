import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Trash2, Check } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';

interface VoidReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title?: string;
  itemInfo?: {
    name: string;
    quantity: number;
    amount?: number;
  };
}

export const VOID_REASONS = [
  { id: 'changed_mind', label: '🔄 Customer Changed Mind', text: 'Customer Changed Mind' },
  { id: 'quality_issue', label: '⚠️ Quality Issue / Complaint', text: 'Quality Issue / Food Complaint' },
  { id: 'wrong_punch', label: '❌ Wrong Punch / Mistake', text: 'Wrong Item Punched' },
  { id: 'delayed', label: '⏱️ Delayed Preparation / Delivery', text: 'Delayed Preparation / Delivery' },
  { id: 'out_of_stock', label: '🚫 Item Out of Stock', text: 'Item Out of Stock / Kitchen Issue' },
  { id: 'duplicate', label: '📑 Duplicate / Billing Error', text: 'Duplicate / Billing Error' },
];

const VoidReasonModal: React.FC<VoidReasonModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemInfo,
}) => {
  const { t } = useTranslation();
  const [selectedReason, setSelectedReason] = useState<string>('Customer Changed Mind');
  const [customReason, setCustomReason] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    const reason = customReason.trim() ? customReason.trim() : selectedReason;
    onConfirm(reason);
    setSelectedReason('Customer Changed Mind');
    setCustomReason('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || t('voidModal.title', 'Void / Cancellation Reason')}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 size={13} />}
            onClick={handleConfirm}
            disabled={!selectedReason && !customReason.trim()}
          >
            {t('voidModal.confirmVoid', 'Confirm Void')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Warning Banner */}
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2.5">
          <AlertTriangle size={18} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs text-red-900 dark:text-red-200">
            <p className="font-semibold">{t('voidModal.warningTitle', 'Void Audit Requirement')}</p>
            <p className="text-[11px] text-red-700 dark:text-red-300 mt-0.5">
              {itemInfo
                ? t('voidModal.itemWarning', 'This item was already sent to the kitchen. Please provide a mandatory cancellation reason for the audit report.')
                : t('voidModal.orderWarning', 'Cancelling this active order will be recorded in the Void Audit Log with the selected reason.')}
            </p>
          </div>
        </div>

        {/* Item Info Summary */}
        {itemInfo && (
          <div className="bg-gray-50 dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-900 dark:text-white">
              {itemInfo.quantity}× {itemInfo.name}
            </span>
            {itemInfo.amount !== undefined && (
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                ₹{(itemInfo.amount / 100).toFixed(2)}
              </span>
            )}
          </div>
        )}

        {/* Preset Reasons */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t('voidModal.selectReason', 'Select Reason:')}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {VOID_REASONS.map((r) => {
              const isSelected = selectedReason === r.text && !customReason.trim();
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setSelectedReason(r.text);
                    setCustomReason('');
                  }}
                  className={`p-2 rounded-lg text-left text-xs font-medium border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 font-semibold shadow-xs'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <span>{r.label}</span>
                  {isSelected && <Check size={13} className="text-red-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Reason Input */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {t('voidModal.otherReason', 'Or Type Custom Explanation:')}
          </label>
          <input
            type="text"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder={t('voidModal.customPlaceholder', 'e.g., Guest had food allergy, order recreated on table 4...')}
            className="w-full text-xs px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400"
          />
        </div>
      </div>
    </Modal>
  );
};

export default VoidReasonModal;
