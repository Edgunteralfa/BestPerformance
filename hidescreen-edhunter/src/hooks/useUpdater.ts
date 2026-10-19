// MIT License - Copyright (c) 2026 BestPerformance Contributors

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { exit } from '@tauri-apps/plugin-process';
import { appConfirm, appMessage } from '../dialogQueue';
import { checkForUpdates } from '../utils/updateChecker';
import { formatMessage, text, type Language } from '../i18n';

const APP_VERSION = __APP_VERSION__;
let updateCheckStarted = false;

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

  const doDownloadAndInstall = useCallback(async (url: string) => {
    setState((s) => ({ ...s, downloading: true }));

    try {
      await invoke('download_and_launch_update', { url });
      await exit(0);
    } catch (error) {
      console.error('Update failed:', error);
      setState((s) => ({ ...s, downloading: false }));
      const name = displayNameRef.current;
      const language = languageRef.current;
      await appMessage(text(language, 'updateDownloadFailed'), {
        title: formatMessage(text(language, 'updateTitle'), { app: name }),
        kind: 'error',
      });
    }
  }, []);

  // Check for updates and auto-prompt the user
  useEffect(() => {
    if (!autoCheck || updateCheckStarted) return;
    updateCheckStarted = true;

    const checkAndPrompt = async () => {
      let info;
      try {
        info = await checkForUpdates(APP_VERSION);
      } catch (error) {
        console.error('Update check failed:', error);
        setState((s) => ({ ...s, checked: true }));
        const name = displayNameRef.current;
        const language = languageRef.current;
        const detail = error instanceof Error ? error.message : String(error);
        await appMessage(formatMessage(text(language, 'updateCheckFailed'), { detail }), {
          title: formatMessage(text(language, 'updateTitle'), { app: name }),
          kind: 'error',
        });
        return;
      }

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
      const language = languageRef.current;
      const yes = await appConfirm(
        formatMessage(text(language, 'updatePrompt'), { version: info.latestVersion }),
        { title: formatMessage(text(language, 'updateTitle'), { app: name }), kind: 'info' },
      );

      if (yes) {
        await doDownloadAndInstall(info.downloadUrl);
      }
    };

    checkAndPrompt();
  }, [autoCheck, doDownloadAndInstall]);

  const downloadAndInstall = useCallback(async () => {
    if (!state.downloadUrl) return;
    await doDownloadAndInstall(state.downloadUrl);
  }, [doDownloadAndInstall, state.downloadUrl]);

  return {
    ...state,
    downloadAndInstall,
    appVersion: APP_VERSION,
  };
}
