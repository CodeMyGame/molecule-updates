import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Trash2, Check, Lock, KeyRound } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { useAuthStore } from '../../stores/auth.store';

interface VoidReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, staffId?: number) => void;
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

const MASTER_PASSWORD = 'zblack';

const VoidReasonModal: React.FC<VoidReasonModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemInfo,
}) => {
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.currentUser);

  const [selectedReason, setSelectedReason] = useState<string>('Customer Changed Mind');
  const [customReason, setCustomReason] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedReason('Customer Changed Mind');
      setCustomReason('');
      setPassword('');
      setPasswordError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const reason = customReason.trim() ? customReason.trim() : selectedReason;
    if (!reason) return;

    // Always verify master password 'zblack' (like in Reports)
    if (password.trim() !== MASTER_PASSWORD) {
      setPasswordError(t('reports.incorrectPassword', 'Incorrect password'));
      setPassword('');
      return;
    }

    setPasswordError('');
    onConfirm(reason, currentUser?.id);
    onClose();
  };

  const hasReason = !!selectedReason || !!customReason.trim();
  const canConfirm = hasReason && password.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || t('voidModal.title', 'Cancellation Reason')}
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
            disabled={!canConfirm}
          >
            {t('voidModal.confirmVoid', 'Confirm Cancellation')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Warning Banner */}
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2.5">
          <AlertTriangle size={18} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs text-red-900 dark:text-red-200">
            <p className="font-semibold">{t('voidModal.warningTitle', 'Item Already Sent to Kitchen')}</p>
            <p className="text-[11px] text-red-700 dark:text-red-300 mt-0.5">
              {itemInfo
                ? t('voidModal.itemWarning', 'This item was already sent to the kitchen. Please select a reason for cancelling it.')
                : t('voidModal.orderWarning', 'Cancelling this active order will be recorded in your daily summary with the selected reason.')}
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

        {/* Password Authorization (Always Required - 'zblack') */}
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold text-xs">
              <Lock size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{t('voidModal.managerAuthRequired', 'Password Required')}</span>
            </div>
            {currentUser && (
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                {currentUser.name} ({currentUser.role})
              </span>
            )}
          </div>
          <p className="text-[11px] text-amber-800 dark:text-amber-300">
            {t('voidModal.managerAuthNotice', 'Items or orders sent to the kitchen require password authorization to cancel.')}
          </p>

          <div>
            <div className="relative">
              <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canConfirm) {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
                placeholder={t('reports.password', 'Enter Password')}
                className={`w-full pl-9 pr-3 py-2 text-sm font-medium border rounded-lg focus:outline-none focus:ring-2 bg-white dark:bg-gray-800 ${
                  passwordError
                    ? 'border-red-500 focus:ring-red-400 text-red-600 dark:text-red-400'
                    : 'border-amber-300 dark:border-amber-700 focus:ring-amber-400 focus:border-amber-500 text-gray-900 dark:text-white'
                }`}
                autoFocus
              />
            </div>
            {passwordError && (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-1.5 flex items-center gap-1">
                <AlertTriangle size={13} className="shrink-0" />
                {passwordError}
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default VoidReasonModal;
