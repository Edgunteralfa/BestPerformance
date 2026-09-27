// MIT License - Copyright (c) 2026 BestPerformance Contributors

import { invoke } from '@tauri-apps/api/core';

export interface UpdateInfo {
  updateAvailable: boolean;
  latestVersion: string;
  downloadUrl: string | null;
  releaseNotes: string;
}

export function parseVersion(str: string): number[] {
  return str
    .replace(/^v/, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}

export function isNewerVersion(latest: string, current: string): boolean {
  const l = parseVersion(latest);
  const c = parseVersion(current);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const lv = l[i] || 0;
    const cv = c[i] || 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

export async function checkForUpdates(
  currentVersion: string,
): Promise<UpdateInfo> {
  const release = JSON.parse(await invoke<string>('fetch_latest_release')) as {
      tag_name?: string;
      body?: string;
      assets?: Array<{ name: string; browser_download_url: string }>;
    };
    const latestVersion: string = (release.tag_name || '').replace(/^v/, '');
    const updateAvailable = isNewerVersion(latestVersion, currentVersion);

    const mac = navigator.userAgent.includes('Mac');
    let downloadUrl: string | null = null;
    if (release.assets && Array.isArray(release.assets)) {
      const setupAsset = release.assets.find((a: { name: string }) => {
        const name = a.name.toLowerCase();
        return mac ? name.endsWith('.dmg') : name.endsWith('-setup.exe');
      });
      if (setupAsset) {
        downloadUrl = setupAsset.browser_download_url;
      }
    }

    return {
      updateAvailable,
      latestVersion,
      downloadUrl,
      releaseNotes: release.body || '',
    };
}
