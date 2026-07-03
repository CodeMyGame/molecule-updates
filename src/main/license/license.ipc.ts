import { ipcMain } from 'electron';
import { LICENSE } from '../../shared/ipc-channels';
import * as licenseService from './license.service';

type IpcResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

function handle<T>(channel: string, handler: (...args: any[]) => Promise<T> | T): void {
  ipcMain.handle(channel, async (_event, ...args): Promise<IpcResult<T>> => {
    try {
      const data = await handler(...args);
      return { success: true, data };
    } catch (err: any) {
      console.error(`IPC error [${channel}]:`, err);
      return { success: false, error: err.message || 'Unknown error' };
    }
  });
}

export function registerLicenseHandlers(): void {
  handle(LICENSE.getStatus, () => licenseService.getLicenseStatus());
  handle(LICENSE.activate, (key: string) => licenseService.activateLicense(key));
  handle(LICENSE.clear, () => licenseService.clearLicense());
}
