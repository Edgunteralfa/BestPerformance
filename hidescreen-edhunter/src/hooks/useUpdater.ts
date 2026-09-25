// MIT License - Copyright (c) 2026 BestPerformance Contributors

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { tempDir, join } from '@tauri-apps/api/path';
import { writeFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { exit } from '@tauri-apps/plugin-process';
import { confirm } from '@tauri-apps/plugin-dialog';
import { checkForUpdates } from '../utils/updateChecker';
import type { Language } from '../i18n';

const APP_VERSION = '1.0.0';

interface UpdaterState {
  checked: boolean; // true once the update check has completed
  updateAvailable: boolean;
  updateVersion: string;
  downloadUrl: string | null;
  downloading: boolean;
}

export function useUpdater(autoCheck: boolean, language: Language, displayName: string) {
  const languageRef = useRef(language);
  const displayNameRef = useRef(displayName);
  useEffect(() => {
    languageRef.current = language;
    displayNameRef.current = displayName;
  });

  const [state, setState] = useState<UpdaterState>({
    checked: false,
    updateAvailable: false,
    updateVersion: '',
    downloadUrl: null,
    downloading: false,
  });

  const doDownloadAndInstall = useCallback(async (url: string, version: string) => {
    setState((s) => ({ ...s, downloading: true }));

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());

      const filename = decodeURIComponent(url.split('/').pop() || `BestPerformance-${version}-setup`);
      await writeFile(filename, bytes, { baseDir: BaseDirectory.Temp });

      const tmp = await tempDir();
      const fullPath = await join(tmp, filename);
      await invoke('launch_update_installer', { path: fullPath });

      await exit(0);
    } catch (error) {
      console.error('Update failed:', error);
      setState((s) => ({ ...s, downloading: false }));
    }
  }, []);

  // Check for updates and auto-prompt the user
  useEffect(() => {
    if (!autoCheck) return;

    const checkAndPrompt = async () => {
      const info = await checkForUpdates(APP_VERSION);

      if (!info.updateAvailable || !info.downloadUrl) {
        setState((s) => ({ ...s, checked: true }));
        return;
      }

      setState({
        checked: true,
        updateAvailable: true,
        updateVersion: info.latestVersion,
        downloadUrl: info.downloadUrl,
        downloading: false,
      });

      // Auto-popup the update dialog
      const name = displayNameRef.current;
      const copy = languageRef.current === 'ru'
        ? {
            title: `Обновление ${name}`,
            body: `Вышла версия v${info.latestVersion}.\n\nСкачать и установить сейчас?`,
          }
        : {
            title: `${name} update`,
            body: `Version v${info.latestVersion} is out.\n\nDownload and install it now?`,
          };
      const yes = await confirm(copy.body, { title: copy.title, kind: 'info' });

      if (yes) {
        await doDownloadAndInstall(info.downloadUrl, info.latestVersion);
      }
    };

    checkAndPrompt();
  }, [autoCheck, doDownloadAndInstall]);

  const downloadAndInstall = useCallback(async () => {
    if (!state.downloadUrl) return;
    await doDownloadAndInstall(state.downloadUrl, state.updateVersion);
  }, [doDownloadAndInstall, state.downloadUrl, state.updateVersion]);

  return {
    ...state,
    downloadAndInstall,
    appVersion: APP_VERSION,
  };
}
