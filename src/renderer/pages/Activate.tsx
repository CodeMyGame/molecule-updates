import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLicenseStore } from '../stores/license.store';
import toast from 'react-hot-toast';

function formatKeyInput(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z2-7]/g, '').slice(0, 15);
  const parts: string[] = [];
  for (let i = 0; i < clean.length; i += 5) {
    parts.push(clean.slice(i, i + 5));
  }
  return parts.join('-');
}

const Activate: React.FC = () => {
  const { t } = useTranslation();
  const [keyInput, setKeyInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { activate, status } = useLicenseStore();
  const navigate = useNavigate();

  const isExpired =
    status?.state === 'expired_hard' || status?.state === 'expired_grace';

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setKeyInput(formatKeyInput(e.target.value));
  }, []);

  const mapActivationError = useCallback(
    (raw: string): string => {
      if (raw.includes('expired')) return t('activate.errorExpired');
      if (raw.includes('already') || raw.includes('duplicate')) return t('activate.errorDuplicate');
      if (raw.includes('invalid') || raw.includes('signature') || raw.includes('hmac')) {
        return t('activate.errorSignature');
      }
      if (raw.includes('network') || raw.includes('ECONNREFUSED') || raw.includes('fetch')) {
        return t('activate.errorNetwork');
      }
      if (raw.length > 0) return raw;
      return t('activate.errorInvalid');
    },
    [t]
  );

  const handleActivate = useCallback(async () => {
    const raw = keyInput.replace(/-/g, '');
    if (raw.length !== 15) {
      setError(t('activate.errorIncompleteKey'));
      return;
    }

    setLoading(true);
    setError('');
    try {
      await activate(keyInput);
      await useLicenseStore.getState().fetch();
      toast.success(t('activate.successToast'));
      navigate('/login', { replace: true });
    } catch (err: any) {
      const errRaw: string = err?.message ?? '';
      setError(mapActivationError(errRaw));
    } finally {
      setLoading(false);
    }
  }, [keyInput, activate, navigate, t, mapActivationError]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleActivate();
    },
    [handleActivate]
  );

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#050507] flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Ambient gradient lighting */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-blue-600/25 blur-[120px]" />
        <div className="absolute -bottom-48 -right-32 h-[34rem] w-[34rem] rounded-full bg-indigo-500/20 blur-[130px]" />
        <div className="absolute top-1/3 left-1/2 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-[140px]" />
      </div>

      {/* Subtle vignette */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          background:
            'radial-gradient(120% 120% at 50% 0%, transparent 40%, rgba(0,0,0,0.6) 100%)',
        }}
      />

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Brand */}
        <div className="text-center mb-9">
          <div className="relative inline-flex items-center justify-center mb-5">
            <div className="absolute inset-0 rounded-[1.4rem] bg-gradient-to-br from-blue-500 to-indigo-600 blur-lg opacity-60" />
            <div className="relative inline-flex items-center justify-center w-[4.25rem] h-[4.25rem] rounded-[1.4rem] bg-gradient-to-br from-blue-500 to-indigo-600 ring-1 ring-white/20 shadow-2xl">
              <KeyRound size={30} className="text-white" strokeWidth={2.2} />
            </div>
          </div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-white">
            {t('activate.title')}
          </h1>
          <p className="text-[0.95rem] text-white/50 mt-1.5 font-light">
            {isExpired ? t('activate.subtitleExpired') : t('activate.subtitleNew')}
          </p>
        </div>

        {/* Glass card */}
        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-2xl">
          {isExpired && status?.expiryDate && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-3 py-2.5 mb-4 text-sm">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{t('activate.expiredBanner', { date: status.expiryDate })}</span>
            </div>
          )}

          <label className="text-sm font-medium text-white/70 mb-2 block">
            {t('activate.licenseKeyLabel')}
          </label>

          <input
            type="text"
            value={keyInput}
            onChange={handleChange}
            placeholder={t('activate.keyPlaceholder')}
            autoFocus
            spellCheck={false}
            className={`w-full px-4 py-3 text-center text-lg font-mono tracking-widest rounded-2xl border
              bg-white/[0.06] text-white placeholder-white/30
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:bg-white/[0.09]
              ${
                error
                  ? 'border-red-500/60 focus:ring-red-500/40'
                  : 'border-white/10 focus:ring-blue-500/40 focus:border-white/20'
              }`}
          />

          {error && (
            <div className="flex items-center gap-1.5 text-red-400 text-sm mt-2 animate-fade-in">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleActivate}
            disabled={loading || keyInput.replace(/-/g, '').length < 15}
            className="group mt-5 w-full flex items-center justify-center gap-2 h-14 rounded-2xl
              bg-gradient-to-br from-blue-500 to-indigo-600
              text-white font-medium text-[1.05rem]
              shadow-lg shadow-blue-600/25 ring-1 ring-white/15
              transition-all duration-200
              hover:shadow-xl hover:shadow-blue-600/40 hover:-translate-y-0.5
              active:translate-y-0 active:scale-[0.99]
              disabled:bg-none disabled:bg-white/[0.06] disabled:text-white/30
              disabled:shadow-none disabled:ring-white/5 disabled:translate-y-0
              disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {t('activate.verifying')}
              </>
            ) : (
              <>
                <ShieldCheck size={18} />
                {t('activate.activateButton')}
              </>
            )}
          </button>
        </div>

        <p className="text-center text-white/35 text-xs mt-6">{t('activate.footerHint')}</p>
      </div>
    </div>
  );
};

export default Activate;
