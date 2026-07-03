import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Delete, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/auth.store';
import toast from 'react-hot-toast';

const MAX_PIN_LENGTH = 6;
const MIN_PIN_LENGTH = 4;

function mapLoginError(raw: string, t: (k: string, o?: Record<string, string | number>) => string): string {
  if (raw.startsWith('LOCKOUT:')) {
    const seconds = raw.slice('LOCKOUT:'.length);
    return t('login.lockoutTryAgain', { seconds });
  }
  if (raw === 'INVALID_PIN') {
    return t('login.invalidPin');
  }
  return raw;
}

const Login: React.FC = () => {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [errorDisplay, setErrorDisplay] = useState('');
  const [errorRaw, setErrorRaw] = useState('');
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const isLockedOut = errorRaw.startsWith('LOCKOUT:');

  const handleDigit = (digit: string) => {
    if (pin.length >= MAX_PIN_LENGTH) return;
    if (!isLockedOut) {
      setErrorDisplay('');
      setErrorRaw('');
    }
    setPin((prev) => prev + digit);
  };

  const handleBackspace = () => {
    if (!isLockedOut) {
      setErrorDisplay('');
      setErrorRaw('');
    }
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (!isLockedOut) {
      setErrorDisplay('');
      setErrorRaw('');
    }
    setPin('');
  };

  const handleSubmit = async () => {
    if (pin.length < MIN_PIN_LENGTH) {
      setErrorRaw('');
      setErrorDisplay(t('login.pinMinDigits', { min: MIN_PIN_LENGTH }));
      return;
    }

    try {
      await login(pin);
      toast.success(t('login.welcomeBack'));
      navigate('/billing', { replace: true });
    } catch (err: any) {
      const raw = String(err?.message ?? 'INVALID_PIN');
      setErrorRaw(raw);
      setErrorDisplay(mapLoginError(raw, t));
      setPin('');
      toast.error(mapLoginError(raw, t));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key >= '0' && e.key <= '9') {
      handleDigit(e.key);
    } else if (e.key === 'Backspace') {
      handleBackspace();
    } else if (e.key === 'Enter' && pin.length >= MIN_PIN_LENGTH) {
      handleSubmit();
    } else if (e.key === 'Escape') {
      handleClear();
    }
  };

  const digitButtons = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div
      className="relative flex items-center justify-center min-h-screen overflow-hidden bg-[#050507]"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Ambient gradient lighting */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-blue-600/25 blur-[120px]" />
        <div className="absolute -bottom-48 -right-32 h-[34rem] w-[34rem] rounded-full bg-indigo-500/20 blur-[130px]" />
        <div className="absolute top-1/3 left-1/2 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-[140px]" />
      </div>

      {/* Subtle grain / vignette */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          background:
            'radial-gradient(120% 120% at 50% 0%, transparent 40%, rgba(0,0,0,0.6) 100%)',
        }}
      />

      <div className="relative w-full max-w-[22rem] px-6 animate-fade-in">
        {/* Brand */}
        <div className="text-center mb-9">
          <div className="relative inline-flex items-center justify-center mb-5">
            <div className="absolute inset-0 rounded-[1.4rem] bg-gradient-to-br from-blue-500 to-indigo-600 blur-lg opacity-60" />
            <div className="relative inline-flex items-center justify-center w-[4.25rem] h-[4.25rem] rounded-[1.4rem] bg-gradient-to-br from-blue-500 to-indigo-600 ring-1 ring-white/20 shadow-2xl">
              <Lock className="text-white" size={30} strokeWidth={2.2} />
            </div>
          </div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-white">
            {t('login.appName')}
          </h1>
          <p className="text-[0.95rem] text-white/50 mt-1.5 font-light">
            {t('login.enterPin')}
          </p>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-3.5 mb-7">
          {Array.from({ length: MAX_PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={`h-3 w-3 rounded-full transition-all duration-300 ease-out ${
                i < pin.length
                  ? 'bg-white scale-100 shadow-[0_0_12px_rgba(255,255,255,0.6)]'
                  : 'bg-white/15 scale-90'
              }`}
            />
          ))}
        </div>

        <div className="h-6 mb-1">
          {errorDisplay && (
            <p className="text-center text-red-400 text-sm animate-fade-in">
              {errorDisplay}
            </p>
          )}
        </div>

        {/* Glass keypad */}
        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-2xl">
          <div className="grid grid-cols-3 gap-3.5">
            {digitButtons.map((digit) => (
              <button
                key={digit}
                onClick={() => handleDigit(digit)}
                disabled={isLoading}
                className="h-16 rounded-2xl border border-white/10 bg-white/[0.06]
                  text-2xl font-light text-white flex items-center justify-center
                  transition-all duration-150 select-none
                  hover:bg-white/[0.12] hover:border-white/20
                  active:scale-95 active:bg-white/20
                  disabled:opacity-40 disabled:pointer-events-none"
              >
                {digit}
              </button>
            ))}

            <button
              onClick={handleClear}
              disabled={isLoading}
              className="h-16 rounded-2xl border border-transparent
                text-sm font-medium text-white/50 flex items-center justify-center
                transition-all duration-150 select-none
                hover:text-white/90 hover:bg-white/[0.06]
                active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              {t('login.clear')}
            </button>

            <button
              onClick={() => handleDigit('0')}
              disabled={isLoading}
              className="h-16 rounded-2xl border border-white/10 bg-white/[0.06]
                text-2xl font-light text-white flex items-center justify-center
                transition-all duration-150 select-none
                hover:bg-white/[0.12] hover:border-white/20
                active:scale-95 active:bg-white/20
                disabled:opacity-40 disabled:pointer-events-none"
            >
              0
            </button>

            <button
              onClick={handleBackspace}
              disabled={isLoading}
              className="h-16 rounded-2xl border border-transparent
                text-white/60 flex items-center justify-center
                transition-all duration-150 select-none
                hover:text-white hover:bg-white/[0.06]
                active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Delete size={22} />
            </button>
          </div>

          <button
            onClick={handleSubmit}
            disabled={pin.length < MIN_PIN_LENGTH || isLoading || isLockedOut}
            className="group w-full mt-5 h-14 rounded-2xl
              bg-gradient-to-br from-blue-500 to-indigo-600
              text-white font-medium text-[1.05rem] flex items-center justify-center gap-2
              shadow-lg shadow-blue-600/25 ring-1 ring-white/15
              transition-all duration-200
              hover:shadow-xl hover:shadow-blue-600/40 hover:-translate-y-0.5
              active:translate-y-0 active:scale-[0.99]
              disabled:bg-none disabled:bg-white/[0.06] disabled:text-white/30
              disabled:shadow-none disabled:ring-white/5 disabled:translate-y-0
              disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {t('login.signIn')}
                <ArrowRight
                  size={18}
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
