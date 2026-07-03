import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';

type UpdateState = 'idle' | 'available' | 'downloading' | 'ready' | 'error';

export default function UpdateNotification(): JSX.Element | null {
  const [state, setState] = useState<UpdateState>('idle');
  const [version, setVersion] = useState('');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!window.electronAPI?.updater) return;

    const unsub1 = window.electronAPI.updater.onUpdateAvailable((info) => {
      setVersion(info.version);
      setState('available');
      setDismissed(false);
    });
    const unsub2 = window.electronAPI.updater.onDownloadProgress((p) => {
      setState('downloading');
      setProgress(Math.round(p.percent));
    });
    const unsub3 = window.electronAPI.updater.onUpdateDownloaded((info) => {
      setVersion(info.version);
      setState('ready');
    });
    const unsub4 = window.electronAPI.updater.onError((msg) => {
      setErrorMsg(msg);
      setState('error');
    });

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, []);

  if (state === 'idle' || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
      <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white font-semibold text-sm">
          <RefreshCw size={16} />
          App Update
        </div>
        {state !== 'downloading' ? (
          <button onClick={() => setDismissed(true)} className="text-white/70 hover:text-white">
            <X size={16} />
          </button>
        ) : null}
      </div>

      <div className="px-4 py-3">
        {state === 'available' ? (
          <p className="text-sm text-gray-700">Version <strong>{version}</strong> is available. Downloading in background…</p>
        ) : state === 'downloading' ? (
          <>
            <p className="text-sm text-gray-700 mb-2">Downloading update… {progress}%</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : state === 'ready' ? (
          <>
            <p className="text-sm text-gray-700 mb-3">
              Version <strong>{version}</strong> is ready. Restart to apply the update.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => window.electronAPI.updater.installNow()}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg"
              >
                <Download size={14} />
                Restart & Update
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg border"
              >
                Later
              </button>
            </div>
          </>
        ) : state === 'error' ? (
          <p className="text-sm text-red-600">Update check failed: {errorMsg}</p>
        ) : null}
      </div>
    </div>
  );
}
