import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, ShoppingBag, Tag, Check, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ipc } from '../../lib/ipc';

interface ParcelNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName?: string | null;
  onConfirm: (name: string | null) => void;
  title?: string;
  confirmLabel?: string;
}

const LOCAL_STORAGE_KEY = 'molecule_custom_parcel_presets';
const SETTING_KEY = 'custom_parcel_presets';

const DEFAULT_PARCEL_PARTNERS = [
  { label: 'Zomato', icon: '🛵', color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100/80 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50' },
  { label: 'Swiggy', icon: '📦', color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100/80 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/50' },
  { label: 'Blinkit', icon: '⚡', color: 'bg-yellow-50 text-yellow-800 border-yellow-200 hover:bg-yellow-100/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50' },
  { label: 'Dunzo', icon: '🛵', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50' },
  { label: 'Takeaway', icon: '🛍️', color: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100/80 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900/50' },
  { label: 'Walk-in', icon: '👤', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50' },
];

function getStoredPresets(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === 'string' && s.trim().length > 0);
    }
  } catch {
    // Ignore fallback
  }
  return [];
}

export const ParcelNameModal: React.FC<ParcelNameModalProps> = ({
  isOpen,
  onClose,
  currentName,
  onConfirm,
  title,
  confirmLabel,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [customPresets, setCustomPresets] = useState<string[]>(getStoredPresets);
  const [isAddingPreset, setIsAddingPreset] = useState(false);
  const [newPresetInput, setNewPresetInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const addPresetInputRef = useRef<HTMLInputElement>(null);

  // Sync with DB settings on modal open
  useEffect(() => {
    if (isOpen) {
      setName(currentName || '');
      setIsAddingPreset(false);
      setNewPresetInput('');
      setTimeout(() => inputRef.current?.focus(), 80);

      ipc<string | null>(window.electronAPI.settings.get(SETTING_KEY))
        .then((val) => {
          if (val) {
            try {
              const list = JSON.parse(val);
              if (Array.isArray(list)) {
                const cleaned = list.filter((s) => typeof s === 'string' && s.trim().length > 0);
                setCustomPresets(cleaned);
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleaned));
              }
            } catch {
              // Ignore JSON parse errors
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen, currentName]);

  const handleAddCustomPreset = async (presetToAdd: string) => {
    const clean = presetToAdd.trim();
    if (!clean) return;

    const allExisting = [
      ...DEFAULT_PARCEL_PARTNERS.map((p) => p.label.toLowerCase()),
      ...customPresets.map((p) => p.toLowerCase()),
    ];

    if (allExisting.includes(clean.toLowerCase())) {
      toast(t('billing.presetExists', { defaultValue: 'Quick select already exists' }), { icon: 'ℹ️' });
      return;
    }

    const updated = [...customPresets, clean];
    setCustomPresets(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    try {
      await ipc(window.electronAPI.settings.set(SETTING_KEY, JSON.stringify(updated), 'general'));
      toast.success(t('billing.presetAdded', { defaultValue: `Added "${clean}" to quick select!`, name: clean }));
    } catch {
      // Non-fatal fallback
    }
  };

  const handleDeleteCustomPreset = async (presetToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customPresets.filter((p) => p.toLowerCase() !== presetToDelete.toLowerCase());
    setCustomPresets(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    try {
      await ipc(window.electronAPI.settings.set(SETTING_KEY, JSON.stringify(updated), 'general'));
      toast.success(t('billing.presetRemoved', { defaultValue: 'Removed quick select' }));
    } catch {
      // Non-fatal
    }
  };

  const canSaveCurrentAsPreset = useMemo(() => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return false;
    const all = [
      ...DEFAULT_PARCEL_PARTNERS.map((p) => p.label.toLowerCase()),
      ...customPresets.map((p) => p.toLowerCase()),
    ];
    return !all.includes(trimmed.toLowerCase());
  }, [name, customPresets]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = name.trim();
    onConfirm(trimmed.length > 0 ? trimmed : null);
    onClose();
  };

  const handleSkip = () => {
    onConfirm(null);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-[390px] overflow-hidden border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-emerald-950/40 border-b border-emerald-100 dark:border-gray-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shadow-xs shrink-0">
              <ShoppingBag size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                {title || t('billing.parcelNameModalTitle', { defaultValue: 'Parcel Name / Partner' })}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                {t('billing.parcelNameOptionalHint', { defaultValue: 'Optional: tag Zomato, Swiggy, or reference' })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Preset quick buttons section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                {t('billing.quickPresets', { defaultValue: 'Quick Select' })}
              </label>
              {!isAddingPreset && (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingPreset(true);
                    setTimeout(() => addPresetInputRef.current?.focus(), 80);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 transition-colors active:scale-95"
                >
                  <Plus size={11} strokeWidth={2.5} />
                  <span>{t('common.add', { defaultValue: 'Add' })}</span>
                </button>
              )}
            </div>

            {/* Inline add form */}
            {isAddingPreset && (
              <div className="flex items-center gap-1.5 p-1.5 mb-2.5 bg-emerald-50/90 border border-emerald-200 rounded-xl animate-in fade-in duration-150">
                <input
                  ref={addPresetInputRef}
                  type="text"
                  value={newPresetInput}
                  onChange={(e) => setNewPresetInput(e.target.value)}
                  placeholder={t('billing.newPresetPlaceholder', { defaultValue: 'Preset name (e.g. Magicpin, Direct)' })}
                  maxLength={25}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newPresetInput.trim()) {
                        handleAddCustomPreset(newPresetInput);
                        setNewPresetInput('');
                        setIsAddingPreset(false);
                      }
                    } else if (e.key === 'Escape') {
                      setIsAddingPreset(false);
                      setNewPresetInput('');
                    }
                  }}
                  className="flex-1 px-2.5 py-1 text-xs bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 font-medium text-gray-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newPresetInput.trim()) {
                      handleAddCustomPreset(newPresetInput);
                      setNewPresetInput('');
                      setIsAddingPreset(false);
                    }
                  }}
                  disabled={!newPresetInput.trim()}
                  className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {t('common.add', { defaultValue: 'Add' })}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingPreset(false);
                    setNewPresetInput('');
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-emerald-100/50 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Symmetric 3-column grid for built-in partners */}
            <div className="grid grid-cols-3 gap-2">
              {DEFAULT_PARCEL_PARTNERS.map((preset) => {
                const isSelected = name.trim().toLowerCase() === preset.label.toLowerCase();
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setName(preset.label);
                      inputRef.current?.focus();
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 ring-2 ring-emerald-500/80 shadow-xs font-bold'
                        : `${preset.color} active:scale-98`
                    }`}
                  >
                    <span className="text-sm">{preset.icon}</span>
                    <span className="truncate">{preset.label}</span>
                    {isSelected && <Check size={11} strokeWidth={2.5} className="ml-0.5 text-emerald-700 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Custom user presets list */}
            {customPresets.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-gray-100">
                <div className="flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto pr-0.5">
                  {customPresets.map((preset) => {
                    const isSelected = name.trim().toLowerCase() === preset.toLowerCase();
                    return (
                      <div
                        key={preset}
                        onClick={() => {
                          setName(preset);
                          inputRef.current?.focus();
                        }}
                        className={`group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-400 ring-2 ring-emerald-500/80 shadow-xs font-bold'
                            : 'bg-teal-50/80 text-teal-800 border-teal-200 hover:bg-teal-100/90 active:scale-98'
                        }`}
                      >
                        <span className="text-[11px]">🏷️</span>
                        <span className="truncate max-w-[120px]">{preset}</span>
                        {isSelected && <Check size={11} strokeWidth={2.5} className="ml-0.5 text-emerald-700" />}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCustomPreset(preset, e)}
                          title={t('common.delete', { defaultValue: 'Delete' })}
                          className="ml-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-teal-500 hover:text-red-600 hover:bg-red-50 transition-colors opacity-70 group-hover:opacity-100"
                        >
                          <X size={9} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Text Input Section */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              {t('billing.customParcelName', { defaultValue: 'Name or Order Note' })}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Tag size={13} />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('billing.parcelPlaceholder', { defaultValue: 'e.g. Zomato #482, Rahul, Party' })}
                maxLength={40}
                className="w-full pl-8 pr-8 py-2.5 rounded-xl text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-hidden font-medium text-gray-900 dark:text-gray-100"
              />
              {name.length > 0 && (
                <button
                  type="button"
                  onClick={() => setName('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Quick helper to save whatever was typed as a permanent quick select button */}
            {canSaveCurrentAsPreset && (
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => handleAddCustomPreset(name)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 transition-all cursor-pointer active:scale-95 shadow-2xs"
                >
                  <Plus size={10} strokeWidth={2.5} />
                  <span>
                    {t('billing.saveToQuickSelect', {
                      defaultValue: `Save "${name.trim()}" to Quick Select`,
                      name: name.trim(),
                    })}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Action buttons footer */}
          <div className="flex items-center gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={handleSkip}
              className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-98 transition-all"
            >
              {t('common.skip', { defaultValue: 'Skip (No Name)' })}
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 transition-all shadow-xs flex items-center justify-center gap-1.5"
            >
              <Check size={14} strokeWidth={2.5} />
              <span>{confirmLabel || t('common.done', { defaultValue: 'Done (Enter)' })}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ParcelNameModal;
