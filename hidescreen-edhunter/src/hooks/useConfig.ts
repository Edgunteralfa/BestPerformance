// MIT License - Copyright (c) 2026 BestPerformance Contributors

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';
import type { Config } from '../types';
import { DEFAULT_CONFIG, normalizeChapterBudgets, normalizeOpacity, normalizePitchMemories, normalizePitchSeconds, normalizeTabs, normalizeWindowMask } from '../types';
import { detectLanguage } from '../i18n';

const STORE_FILE = 'config.json';

function storeFile(): Promise<string> {
  return invoke<string>('config_store_path').catch(() => STORE_FILE);
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function useConfig() {
  const [config, setConfigState] = useState<Config>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  // Load config from store
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const store = await load(await storeFile());

        const loaded: Partial<Config> = {};
        let savedLanguage = false;
        for (const key of Object.keys(DEFAULT_CONFIG)) {
          const value = await store.get(key);
          if (value !== null && value !== undefined) {
            (loaded as Record<string, unknown>)[key] = value;
            if (key === 'language') savedLanguage = true;
          }
        }

        if (!savedLanguage) {
          loaded.language = detectLanguage();
        }

        const tabs = normalizeTabs(loaded.tabs, typeof loaded.text === 'string' ? loaded.text : '');
        const pitchMemories = normalizePitchMemories(loaded.pitchMemories);
        const activeTabId = tabs.some((tab) => tab.id === loaded.activeTabId)
          ? loaded.activeTabId
          : tabs[0].id;
        const active = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

        setConfigState({
          ...DEFAULT_CONFIG,
          ...loaded,
          tabs,
          activeTabId: active.id,
          text: active.text,
          pitchSeconds: normalizePitchSeconds(loaded.pitchSeconds),
          chapterBudgets: normalizeChapterBudgets(loaded.chapterBudgets),
          cardText: typeof loaded.cardText === 'string' ? loaded.cardText : '',
          cardVisible: loaded.cardVisible === true,
          cardX: finiteOr(loaded.cardX, DEFAULT_CONFIG.cardX),
          cardY: finiteOr(loaded.cardY, DEFAULT_CONFIG.cardY),
          cardWidth: finiteOr(loaded.cardWidth, DEFAULT_CONFIG.cardWidth),
          cardHeight: finiteOr(loaded.cardHeight, DEFAULT_CONFIG.cardHeight),
          cardFontSize: Math.min(48, Math.max(8, finiteOr(loaded.cardFontSize, DEFAULT_CONFIG.cardFontSize))),
          opacity: normalizeOpacity(loaded.opacity),
          cardOpacity: normalizeOpacity(loaded.cardOpacity === undefined ? loaded.opacity : loaded.cardOpacity),
          windowMask: normalizeWindowMask(loaded.windowMask),
          pitchMemories,
          activePitchId: pitchMemories.some((item) => item.id === loaded.activePitchId)
            ? String(loaded.activePitchId)
            : null,
          pitchEpoch: finiteOr(loaded.pitchEpoch, 0),
        });
      } catch (error) {
        console.error('Failed to load config:', error);
        setConfigState(DEFAULT_CONFIG);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  // Save config to store
  const setConfig = useCallback(async (updates: Partial<Config>) => {
    try {
      setConfigState((current) => ({ ...current, ...updates }));

      const store = await load(await storeFile());
      for (const [key, value] of Object.entries(updates)) {
        await store.set(key, value);
      }
      await store.save();
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }, []);

  return { config, setConfig, loading };
}
