import { app, BrowserWindow, shell } from 'electron';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { logger } from '../utils/logger';

export interface ReleaseAsset {
  name: string;
  downloadUrl: string;
  size: number;
}

export interface PastRelease {
  version: string;
  name: string;
  publishedAt: string;
  body?: string;
  asset?: ReleaseAsset;
}

/**
 * Fetch public releases from GitHub repository
 */
export async function getPastReleases(): Promise<PastRelease[]> {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/CodeMyGame/molecule-updates/releases?per_page=15',
      headers: {
        'User-Agent': `Molecule-POS/${app.getVersion()}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    };

    https
      .get(options, (res) => {
        if (res.statusCode !== 200) {
          logger.warn(`Failed to fetch GitHub releases: HTTP ${res.statusCode}`);
          return resolve([]);
        }
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const list = JSON.parse(rawData);
            if (!Array.isArray(list)) return resolve([]);

            const isWin = process.platform === 'win32';
            const isMac = process.platform === 'darwin';
            const arch = process.arch;

            const result: PastRelease[] = [];

            for (const r of list) {
              const version = (r.tag_name || '').replace(/^v/, '');
              if (r.draft) continue;

              let matchedAsset: ReleaseAsset | undefined;

              if (isWin) {
                const asset =
                  r.assets?.find(
                    (a: any) =>
                      a.name.endsWith('.exe') && a.name.toLowerCase().includes('setup')
                  ) || r.assets?.find((a: any) => a.name.endsWith('.exe'));

                if (asset) {
                  matchedAsset = {
                    name: asset.name,
                    downloadUrl: asset.browser_download_url,
                    size: asset.size,
                  };
                }
              } else if (isMac) {
                const asset =
                  r.assets?.find(
                    (a: any) =>
                      a.name.endsWith('.dmg') &&
                      (arch === 'arm64' ? a.name.includes('arm64') : a.name.includes('x64'))
                  ) || r.assets?.find((a: any) => a.name.endsWith('.dmg'));

                if (asset) {
                  matchedAsset = {
                    name: asset.name,
                    downloadUrl: asset.browser_download_url,
                    size: asset.size,
                  };
                }
              }

              if (matchedAsset) {
                result.push({
                  version,
                  name: r.name || version,
                  publishedAt: r.published_at,
                  body: r.body || '',
                  asset: matchedAsset,
                });
              }
            }

            resolve(result);
          } catch (err) {
            logger.error('Failed to parse GitHub releases JSON:', err);
            resolve([]);
          }
        });
      })
      .on('error', (err) => {
        logger.error('Network error fetching GitHub releases:', err);
        resolve([]);
      });
  });
}

function downloadWithRedirects(
  urlStr: string,
  destPath: string,
  onProgress: (loaded: number, total: number) => void,
  maxRedirects = 5
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Too many redirects while downloading installer'));
    }

    const fileStream = fs.createWriteStream(destPath);
    let isFinished = false;

    const request = https.get(
      urlStr,
      {
        headers: {
          'User-Agent': `Molecule-POS/${app.getVersion()}`,
          'Accept': 'application/octet-stream',
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fileStream.close();
          try {
            fs.unlinkSync(destPath);
          } catch {}
          return downloadWithRedirects(res.headers.location, destPath, onProgress, maxRedirects - 1)
            .then(resolve)
            .catch(reject);
        }

        if (res.statusCode !== 200) {
          fileStream.close();
          try {
            fs.unlinkSync(destPath);
          } catch {}
          return reject(new Error(`Download failed with HTTP status ${res.statusCode}`));
        }

        const total = parseInt(res.headers['content-length'] || '0', 10);
        let loaded = 0;

        res.on('data', (chunk) => {
          loaded += chunk.length;
          onProgress(loaded, total);
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          if (!isFinished) {
            isFinished = true;
            fileStream.close(() => resolve());
          }
        });
      }
    );

    request.on('error', (err) => {
      fileStream.close();
      try {
        fs.unlinkSync(destPath);
      } catch {}
      reject(err);
    });

    fileStream.on('error', (err) => {
      fileStream.close();
      try {
        fs.unlinkSync(destPath);
      } catch {}
      reject(err);
    });
  });
}

/**
 * Downloads the chosen installer to OS temp directory and launches it
 */
export async function downloadAndRollback(
  downloadUrl: string,
  fileName: string,
  window: BrowserWindow | null,
  onProgress?: (progress: { percent: number; downloaded: number; total: number }) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    const tempDir = app.getPath('temp');
    const targetPath = path.join(tempDir, fileName);

    if (fs.existsSync(targetPath)) {
      try {
        fs.unlinkSync(targetPath);
      } catch {}
    }

    logger.info(`Starting rollback installer download: ${downloadUrl} -> ${targetPath}`);

    await downloadWithRedirects(downloadUrl, targetPath, (loaded, total) => {
      const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
      onProgress?.({ percent, downloaded: loaded, total });
      if (window && !window.isDestroyed()) {
        window.webContents.send('updater:rollback-progress', { percent, downloaded: loaded, total });
      }
    });

    logger.info(`Rollback installer downloaded successfully: ${targetPath}. Launching installer...`);

    if (process.platform === 'win32') {
      const child = spawn(targetPath, [], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      setTimeout(() => {
        app.quit();
      }, 750);
    } else if (process.platform === 'darwin') {
      await shell.openPath(targetPath);
      setTimeout(() => {
        app.quit();
      }, 750);
    }

    return { success: true };
  } catch (err: any) {
    logger.error('Rollback installation failed:', err);
    return { success: false, error: err.message || String(err) };
  }
}
