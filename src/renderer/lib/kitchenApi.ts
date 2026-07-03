import { ipc } from './ipc';
import type { KOTStatus } from '../../shared/enums';
import type { KOT } from '../stores/kot.store';

// In Electron, window.electronAPI is exposed by the preload script.
// In a browser (kitchen tablet pointed at the LAN URL), it's absent — fall back to fetch.
function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electronAPI;
}

async function browserFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch { /* ignore */ }
    if (res.status === 401) throw new Error(detail || 'Unauthorized');
    throw new Error(detail || `Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function getActiveKOTs(): Promise<KOT[]> {
  if (isElectron()) {
    const result = await ipc<KOT[]>(window.electronAPI.kot.getActive());
    return result ?? [];
  }
  return browserFetch<KOT[]>('/api/kots/active');
}

export async function updateKOTStatus(id: number, status: KOTStatus): Promise<void> {
  if (isElectron()) {
    await ipc(window.electronAPI.kot.updateStatus(id, status));
    return;
  }
  await browserFetch<KOT>(`/api/kots/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export function isBrowserMode(): boolean {
  return !isElectron();
}
