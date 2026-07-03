/**
 * Global fetch polyfill for older Electron/Node runtimes (e.g. the Windows 7
 * build pinned to Electron 22 / Node 16, which has no global `fetch`).
 *
 * Firebase references `fetch` at module load time, so this MUST be imported
 * before any module that pulls in Firebase. On Node 18+ the globals already
 * exist and we leave them untouched.
 */
if (typeof (globalThis as any).fetch === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeFetch = require('node-fetch');
  const g = globalThis as any;
  g.fetch = nodeFetch.default || nodeFetch;
  g.Headers = nodeFetch.Headers;
  g.Request = nodeFetch.Request;
  g.Response = nodeFetch.Response;
}

export {};
