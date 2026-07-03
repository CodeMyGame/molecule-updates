import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LicenseStatus } from '../../../shared/types/license.types';

interface LicenseExpiryBannerProps {
  status: LicenseStatus;
}

const LicenseExpiryBanner: React.FC<LicenseExpiryBannerProps> = ({ status }) => {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const isGrace = status.state === 'expired_grace';
  const isSoon = status.state === 'expiring_soon';

  if (!isGrace && !isSoon) return null;

  const bgColor = isGrace ? 'bg-red-600' : 'bg-amber-500';
  const message = isGrace
    ? t('licenseBanner.grace', { count: status.daysRemaining })
    : t('licenseBanner.expiringSoon', { count: status.daysRemaining, date: status.expiryDate });

  return (
    <div className={`${bgColor} text-white px-4 py-2 flex items-center gap-2 text-sm flex-shrink-0`}>
      <AlertTriangle size={15} className="flex-shrink-0" />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="p-0.5 hover:bg-white/20 rounded transition-colors flex-shrink-0"
        title={t('licenseBanner.dismiss')}
        aria-label={t('licenseBanner.dismiss')}
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default LicenseExpiryBanner;
