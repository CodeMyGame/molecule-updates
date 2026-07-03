import type { ElectronAPI } from '../../preload/index';

interface IPCResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

/**
 * Converts raw technical error messages into user-friendly strings.
 */
function friendlyError(raw: string): string {
  if (/FOREIGN KEY constraint failed/i.test(raw)) {
    return 'Cannot delete this item because it is being used elsewhere (e.g. in orders or menu items).';
  }
  if (/UNIQUE constraint failed/i.test(raw)) {
    return 'A record with this name or value already exists. Please use a different one.';
  }
  if (/NOT NULL constraint failed/i.test(raw)) {
    return 'A required field is missing. Please fill in all required fields.';
  }
  if (/no such table/i.test(raw)) {
    return 'A database error occurred. Please restart the app.';
  }
  if (/SQLITE_/i.test(raw) || /SqliteError/i.test(raw)) {
    return 'A database error occurred. Please try again.';
  }
  if (/IPC error/i.test(raw)) {
    return 'An internal error occurred. Please try again.';
  }
  if (raw === 'INVALID_PIN' || /^LOCKOUT:\d+$/.test(raw)) {
    return raw;
  }
  // Return the message only if it looks like a plain English sentence (no stack traces, file paths)
  if (/\n|\/Users\/|\.js:\d|at \w/.test(raw)) {
    return 'An unexpected error occurred. Please try again.';
  }
  return raw;
}

/**
 * Type-safe wrapper that unwraps IPC results.
 * Checks the success flag and throws on error, returning the data on success.
 *
 * Usage:
 *   const categories = await ipc(window.electronAPI.menu.getCategories());
 */
export async function ipc<T>(promise: Promise<IPCResult<T> | T>): Promise<T> {
  const result = await promise;

  // If the result is a plain value (not wrapped in IPCResult), return as-is
  if (result === null || result === undefined) {
    return result as T;
  }

  // Check if it looks like an IPCResult wrapper
  if (
    typeof result === 'object' &&
    'success' in (result as object)
  ) {
    const ipcResult = result as IPCResult<T>;
    if (!ipcResult.success) {
      throw new Error(friendlyError(ipcResult.error ?? 'An unknown error occurred'));
    }
    return ipcResult.data as T;
  }

  // Otherwise return the raw result
  return result as T;
}

/**
 * Safe accessor for electronAPI, useful in environments where preload may not be loaded.
 */
export function getElectronAPI(): ElectronAPI {
  if (!window.electronAPI) {
    throw new Error(
      'electronAPI is not available. Ensure the preload script is loaded correctly.'
    );
  }
  return window.electronAPI;
}
