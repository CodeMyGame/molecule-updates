import React from 'react';
import { Delete } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface NumPadProps {
  onValue: (value: string) => void;
  onClear: () => void;
  onBackspace: () => void;
  onSubmit?: () => void;
  showDecimal?: boolean;
  submitLabel?: string;
}

const NumPad: React.FC<NumPadProps> = ({
  onValue,
  onClear,
  onBackspace,
  onSubmit,
  showDecimal = true,
  submitLabel,
}) => {
  const { t } = useTranslation();
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const resolvedSubmitLabel = submitLabel ?? t('numpad.ok');

  return (
    <div className="grid grid-cols-3 gap-2">
      {digits.map((digit) => (
        <button
          key={digit}
          type="button"
          onClick={() => onValue(digit)}
          className="numpad-btn"
        >
          {digit}
        </button>
      ))}

      {/* Bottom row */}
      {showDecimal ? (
        <button
          type="button"
          onClick={() => onValue('.')}
          className="numpad-btn"
        >
          .
        </button>
      ) : (
        <button
          type="button"
          onClick={onClear}
          className="numpad-btn text-sm text-gray-500"
        >
          {t('numpad.clear')}
        </button>
      )}

      <button
        type="button"
        onClick={() => onValue('0')}
        className="numpad-btn"
      >
        0
      </button>

      <button
        type="button"
        onClick={onBackspace}
        className="numpad-btn"
      >
        <Delete size={20} />
      </button>

      {/* Action row */}
      {showDecimal && (
        <button
          type="button"
          onClick={onClear}
          className="numpad-btn text-sm text-gray-500 col-span-1"
        >
          {t('numpad.clear')}
        </button>
      )}

      {onSubmit && (
        <button
          type="button"
          onClick={onSubmit}
          className={`numpad-btn-primary ${showDecimal ? 'col-span-2' : 'col-span-3 mt-2'}`}
        >
          {resolvedSubmitLabel}
        </button>
      )}
    </div>
  );
};

export default NumPad;
