// MIT License - Copyright (c) 2026 BestPerformance Contributors

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, LogicalPosition, LogicalSize, Window } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { confirm, message } from '@tauri-apps/plugin-dialog';
import { formatMessage, I18nProvider, useI18n } from './i18n';
import { useConfig } from './hooks/useConfig';
import { useUpdater } from './hooks/useUpdater';
import { useGlobalHotkeys } from './hooks/useGlobalHotkeys';
import { formatClock, paceOf, usePitchTimer } from './hooks/usePitchTimer';
import { isMac } from './platform';
import { OPACITY_LEVELS, DEFAULT_CONFIG, chapterBudgetKey, headingAt, windowMaskTitle, type NoteTab } from './types';
import TitleBar from './components/TitleBar';
import TabBar from './components/TabBar';
import TextEditor, { type TextEditorHandle } from './components/TextEditor';
import RehearsalPanel from './components/RehearsalPanel';
import Settings from './components/Settings';
import BottomBar from './components/BottomBar';
import './styles/App.css';

const appWindow = getCurrentWindow();

async function setClickThrough(enabled: boolean) {
  await invoke('set_click_through', { window: appWindow, enabled });
  const card = await Window.getByLabel('card');
  if (card) await invoke('set_click_through', { window: card, enabled });
}
const NUDGE_PX = 20;
const DEFAULT_FONT_SIZE = 14;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;

function App() {
  const { config, setConfig, loading } = useConfig();

  if (loading) {
    return null;
  }

  return (
    <I18nProvider language={config.language}>
      <AppShell config={config} setConfig={setConfig} />
    </I18nProvider>
  );
}

function AppShell({
  config,
  setConfig,
}: {
  config: ReturnType<typeof useConfig>['config'];
  setConfig: ReturnType<typeof useConfig>['setConfig'];
}) {
  const { t } = useI18n();
  const [showSettings, setShowSettings] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [windowActive, setWindowActive] = useState(false);
  const opacityIndex = Math.max(0, OPACITY_LEVELS.indexOf(config.opacity));
  const quickEditRef = useRef(false);
  const editorRef = useRef<TextEditorHandle | null>(null);
  const scrollByTab = useRef<Record<string, number>>({});
  const [navWidth, setNavWidth] = useState(168);
  const [activeChapter, setActiveChapter] = useState<number | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [edgeAlarm, setEdgeAlarm] = useState(false);
  const seenPitchEpoch = useRef(config.pitchEpoch);
  const overChapter = useRef('');
  const alarmTimer = useRef<number | null>(null);
  const resizeDrag = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const shellName = isMac ? windowMaskTitle(config.windowMask) : 'BestPerformance';
  const updater = useUpdater(config.autoCheckUpdates, config.language, shellName);

  useEffect(() => {
    const title = windowMaskTitle(config.windowMask);
    void appWindow.setTitle(title);
    void Window.getByLabel('card').then((card) => card?.setTitle(title));
    if (isMac) document.title = title;
  }, [config.windowMask]);

  // Show ethical notice on first run
  useEffect(() => {
    const showEthicalNotice = async () => {
      if (!config.firstRunShown) {
        try {
          await message(formatMessage(t('ethicalNotice'), { app: shellName }), {
            title: formatMessage(t('noticeTitle'), { app: shellName }),
            kind: 'warning',
          });
          await setConfig({ firstRunShown: true });
        } catch (error) {
          console.error('Failed to show ethical notice:', error);
        }
      }
    };

    showEthicalNotice();
  }, [config.firstRunShown, setConfig, shellName, t]);

  // Toggle click-through mode
  const toggleLock = useCallback(async () => {
    try {
      const newLocked = !isLocked;
      await setClickThrough(newLocked);
      setIsLocked(newLocked);
      await setConfig({ locked: newLocked });

      // Install/uninstall scroll + keyboard hooks
      if (newLocked) {
        await invoke('install_scroll_hook', { window: appWindow }).catch((e: unknown) =>
          console.error('Scroll hook install failed:', e),
        );
        await invoke('install_keyboard_hook').catch((e: unknown) =>
          console.error('Keyboard hook install failed:', e),
        );
      } else {
        await invoke('uninstall_scroll_hook').catch((e: unknown) =>
          console.error('Scroll hook uninstall failed:', e),
        );
        await invoke('uninstall_keyboard_hook').catch((e: unknown) =>
          console.error('Keyboard hook uninstall failed:', e),
        );
      }
    } catch (error) {
      console.error('Failed to toggle lock:', error);
    }
  }, [isLocked, setConfig]);

  // Emergency unlock - always unlocks
  const emergencyUnlock = useCallback(async () => {
    if (!isLocked) return;
    try {
      await setClickThrough(false);
      setIsLocked(false);
      await setConfig({ locked: false });
      await invoke('uninstall_scroll_hook').catch(() => {});
      await invoke('uninstall_keyboard_hook').catch(() => {});
    } catch (error) {
      console.error('Emergency unlock failed:', error);
    }
  }, [isLocked, setConfig]);

  // Quick edit: unlock, focus, auto-relock on blur
  const quickEdit = useCallback(async () => {
    if (!isLocked) return;
    try {
      await setClickThrough(false);
      setIsLocked(false);
      await invoke('uninstall_scroll_hook').catch(() => {});
      await invoke('uninstall_keyboard_hook').catch(() => {});
      quickEditRef.current = true;
      await appWindow.setFocus();
    } catch (error) {
      console.error('Quick edit failed:', error);
    }
  }, [isLocked]);

  // Listen for Escape key (from keyboard hook) to emergency unlock
  useEffect(() => {
    const unlisten = listen('emergency-unlock', () => {
      emergencyUnlock();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [emergencyUnlock]);

  // Listen for window blur to re-lock after quick edit
  useEffect(() => {
    const unlisten = appWindow.onFocusChanged(async ({ payload: focused }) => {
      setWindowActive(focused);
      if (!focused && quickEditRef.current) {
        quickEditRef.current = false;
        try {
          await setClickThrough(true);
          setIsLocked(true);
          await setConfig({ locked: true });
          await invoke('install_scroll_hook', { window: appWindow }).catch(() => {});
          await invoke('install_keyboard_hook').catch(() => {});
        } catch (error) {
          console.error('Quick edit re-lock failed:', error);
        }
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setConfig]);

  // Toggle settings panel
  const toggleSettings = useCallback(() => {
    setShowSettings((prev) => !prev);
  }, []);

  const toggleCard = useCallback(async () => {
    const card = await Window.getByLabel('card');
    if (!card) return;
    const visible = await card.isVisible();
    if (visible) {
      await card.hide();
      await setConfig({ cardVisible: false });
      return;
    }
    if (isLocked) await invoke('set_click_through', { window: card, enabled: true });
    await card.show();
    await card.setFocus();
    await setConfig({ cardVisible: true });
  }, [isLocked, setConfig]);

  // Toggle visibility
  const toggleVisibility = useCallback(async () => {
    if (isVisible) {
      await appWindow.hide();
      setIsVisible(false);
    } else {
      await appWindow.show();
      await appWindow.setFocus();
      setIsVisible(true);
    }
  }, [isVisible]);

  // Font size controls
  const increaseFontSize = useCallback(async () => {
    const newSize = Math.min(48, config.fontSize + 1);
    await setConfig({ fontSize: newSize });
  }, [config.fontSize, setConfig]);

  const decreaseFontSize = useCallback(async () => {
    const newSize = Math.max(8, config.fontSize - 1);
    await setConfig({ fontSize: newSize });
  }, [config.fontSize, setConfig]);

  const resetFontSize = useCallback(async () => {
    await setConfig({ fontSize: DEFAULT_FONT_SIZE });
  }, [setConfig]);

  // Cycle opacity
  const cycleOpacity = useCallback(async () => {
    const nextIndex = (opacityIndex + 1) % OPACITY_LEVELS.length;
    await setConfig({ opacity: OPACITY_LEVELS[nextIndex] });
  }, [opacityIndex, setConfig]);

  // Position presets (3x3 grid: Num1=bottom-left ... Num9=top-right)
  const positionPreset = useCallback(async (index: number) => {
    try {
      const [screenW, screenH] = await invoke<[number, number]>('get_screen_size', {
        window: appWindow,
      });
      const w = config.width;
      const h = config.height;

      // Map numpad positions:
      // 7=TL 8=TC 9=TR
      // 4=ML 5=MC 6=MR
      // 1=BL 2=BC 3=BR
      const col = ((index - 1) % 3); // 0=left, 1=center, 2=right
      const row = 2 - Math.floor((index - 1) / 3); // 0=top, 1=mid, 2=bottom

      const x = col === 0 ? 0 : col === 1 ? (screenW - w) / 2 : screenW - w;
      const y = row === 0 ? 0 : row === 1 ? (screenH - h) / 2 : screenH - h;

      await appWindow.setPosition(new LogicalPosition(Math.round(x), Math.round(y)));
      await setConfig({ x: Math.round(x), y: Math.round(y) });
    } catch (error) {
      console.error('Position preset failed:', error);
    }
  }, [config.width, config.height, setConfig]);

  // Nudge window
  const nudge = useCallback(async (direction: 'up' | 'down' | 'left' | 'right') => {
    try {
      const pos = await appWindow.outerPosition();
      const scale = await appWindow.scaleFactor();
      let x = pos.x / scale;
      let y = pos.y / scale;

      switch (direction) {
        case 'up': y -= NUDGE_PX; break;
        case 'down': y += NUDGE_PX; break;
        case 'left': x -= NUDGE_PX; break;
        case 'right': x += NUDGE_PX; break;
        default: {
          const unreachable: never = direction;
          return unreachable;
        }
      }

      const nextX = Math.round(x);
      const nextY = Math.round(y);
      await appWindow.setPosition(new LogicalPosition(nextX, nextY));
      await setConfig({ x: nextX, y: nextY });
    } catch (error) {
      console.error('Nudge failed:', error);
    }
  }, [setConfig]);

  // Reset window geometry
  const resetGeometry = useCallback(async () => {
    try {
      await appWindow.setSize(new LogicalSize(DEFAULT_CONFIG.width, DEFAULT_CONFIG.height));
      await appWindow.setPosition(new LogicalPosition(DEFAULT_CONFIG.x, DEFAULT_CONFIG.y));
      await setConfig({
        x: DEFAULT_CONFIG.x,
        y: DEFAULT_CONFIG.y,
        width: DEFAULT_CONFIG.width,
        height: DEFAULT_CONFIG.height,
      });
    } catch (error) {
      console.error('Reset geometry failed:', error);
    }
  }, [setConfig]);

  // Quit
  const quit = useCallback(async () => {
    await invoke('uninstall_scroll_hook').catch(() => {});
    await invoke('uninstall_keyboard_hook').catch(() => {});
    await appWindow.close();
  }, []);

  // Panic - instant close
  const panic = useCallback(async () => {
    await invoke('uninstall_scroll_hook').catch(() => {});
    await invoke('uninstall_keyboard_hook').catch(() => {});
    await appWindow.close();
  }, []);

  // Copy all text
  const activeTab = config.tabs.find((tab) => tab.id === config.activeTabId) ?? config.tabs[0];

  const writeActiveText = useCallback(async (text: string) => {
    const tabs = config.tabs.map((tab) => (tab.id === activeTab.id ? { ...tab, text } : tab));
    await setConfig({ tabs, text, activeTabId: activeTab.id });
  }, [activeTab.id, config.tabs, setConfig]);

  const rememberScroll = useCallback((tabId: string, top: number) => {
    scrollByTab.current[tabId] = top;
  }, []);

  const selectTab = useCallback(async (id: string) => {
    const tab = config.tabs.find((item) => item.id === id);
    if (!tab || tab.id === activeTab.id) return;
    const area = document.querySelector('.text-area');
    if (area instanceof HTMLElement) scrollByTab.current[activeTab.id] = area.scrollTop;
    await setConfig({ activeTabId: tab.id, text: tab.text });
  }, [activeTab.id, config.tabs, setConfig]);

  const reorderTabs = useCallback(async (tabs: NoteTab[]) => {
    const active = tabs.find((tab) => tab.id === config.activeTabId) ?? tabs[0];
    await setConfig({ tabs, activeTabId: active.id, text: active.text });
  }, [config.activeTabId, setConfig]);

  const setChapterBudget = useCallback(async (heading: string, seconds: number | null) => {
    const key = chapterBudgetKey(activeTab.id, heading);
    const chapterBudgets = { ...config.chapterBudgets };
    if (seconds === null || seconds <= 0) delete chapterBudgets[key];
    else chapterBudgets[key] = seconds;
    await setConfig({ chapterBudgets });
  }, [activeTab.id, config.chapterBudgets, setConfig]);

  const copyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(activeTab.text);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }, [activeTab.text]);

  // Paste and replace the current tab
  const pasteReplace = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      await writeActiveText(text);
    } catch (error) {
      console.error('Paste failed:', error);
    }
  }, [writeActiveText]);

  // Clear the current tab
  const chapterKey = activeChapter === null ? '' : `${activeTab.id}:${activeChapter}`;
  const timer = usePitchTimer(chapterKey);
  const pitchMs = config.pitchSeconds * 1000;
  const totalRemaining = pitchMs - timer.totalMs;
  const heading = headingAt(activeTab.text, activeChapter);
  const chapterBudgetMs = (heading ? config.chapterBudgets[chapterBudgetKey(activeTab.id, heading)] ?? 0 : 0) * 1000;
  const chapterRemaining = chapterBudgetMs - timer.chapterMs;
  const totalClock = formatClock(pitchMs > 0 ? Math.abs(totalRemaining) : timer.totalMs);
  const chapterClock = formatClock(chapterBudgetMs > 0 ? Math.abs(chapterRemaining) : timer.chapterMs);
  const totalLabel = formatMessage(
    t(pitchMs > 0 ? (totalRemaining < 0 ? 'timerOver' : 'timerLeft') : 'timerTotal'),
    { time: totalClock },
  );
  const chapterLabel = formatMessage(
    t(chapterBudgetMs > 0 ? (chapterRemaining < 0 ? 'timerChapterOver' : 'timerChapterLeft') : 'timerChapter'),
    { time: chapterClock },
  );
  const previousChapter = useCallback(() => {
    editorRef.current?.moveChapter(-1);
  }, []);
  const nextChapter = useCallback(() => {
    editorRef.current?.moveChapter(1);
  }, []);
  const previousLine = useCallback(() => {
    editorRef.current?.moveReading(-1);
  }, []);
  const nextLine = useCallback(() => {
    editorRef.current?.moveReading(1);
  }, []);
  const toggleReview = useCallback(() => {
    setShowReview((open) => !open);
  }, []);

  useEffect(() => {
    if (seenPitchEpoch.current === config.pitchEpoch) return;
    seenPitchEpoch.current = config.pitchEpoch;
    timer.reset();
    scrollByTab.current = {};
  }, [config.pitchEpoch, timer.reset]);

  useEffect(() => {
    const over = chapterBudgetMs > 0 && chapterRemaining <= 0;
    if (over && overChapter.current !== chapterKey) {
      overChapter.current = chapterKey;
      setEdgeAlarm(true);
      if (alarmTimer.current !== null) window.clearTimeout(alarmTimer.current);
      alarmTimer.current = window.setTimeout(() => setEdgeAlarm(false), 1400);
    }
    if (!over) overChapter.current = '';
  }, [chapterBudgetMs, chapterRemaining, chapterKey]);

  const clearText = useCallback(async () => {
    if (!activeTab.text) return;
    const yes = await confirm(t('clearConfirm'), { title: t('clearConfirmTitle'), kind: 'warning' });
    if (!yes) return;
    await writeActiveText('');
  }, [activeTab.text, t, writeActiveText]);

  // Register global hotkeys
  useGlobalHotkeys({
    toggleVisibility,
    toggleLock,
    quickEdit,
    emergencyUnlock,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    cycleOpacity,
    positionPreset,
    nudge,
    toggleSettings,
    resetGeometry,
    quit,
    panic,
    copyAll,
    pasteReplace,
    clearText,
    previousChapter,
    nextChapter,
    previousLine,
    nextLine,
    toggleTimer: timer.toggle,
    resetTimer: timer.reset,
  });

  // Update text in config
  const updateText = async (text: string) => {
    await writeActiveText(text);
  };

  // Handle update badge click (user dismissed the auto-popup earlier)
  const handleUpdateClick = async () => {
    if (!updater.updateAvailable) return;
    await updater.downloadAndInstall();
  };

  useEffect(() => {
    appWindow.show();
    document.documentElement.lang = config.language;
  }, [config.language]);

  useEffect(() => {
    if (!config.cardVisible) return;
    Window.getByLabel('card').then((card) => card?.show()).catch(() => {});
  }, [config.cardVisible]);

  useEffect(() => {
    let alive = true;
    appWindow.isFocused().then((focused) => {
      if (alive) setWindowActive(focused);
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div
      className={`app${windowActive ? ' is-active' : ''}${edgeAlarm ? ' chapter-alarm' : ''}`}
      style={{
        backgroundColor: config.bgColor,
        opacity: config.opacity,
      }}
    >
      <TitleBar
        title={shellName}
        showBrand={!isMac}
        opacity={config.opacity}
        onOpacityChange={(value) => { void setConfig({ opacity: value }); }}
        onSettingsClick={toggleSettings}
        onCardClick={toggleCard}
        checked={updater.checked}
        updateAvailable={updater.updateAvailable}
        updateVersion={updater.updateVersion}
        appVersion={updater.appVersion}
        onUpdateClick={handleUpdateClick}
      />

      <TabBar
        tabs={config.tabs}
        activeTabId={activeTab.id}
        onSelect={selectTab}
        onReorder={reorderTabs}
        totalLabel={totalLabel}
        chapterLabel={chapterLabel}
        totalPace={paceOf(totalRemaining, pitchMs)}
        chapterPace={paceOf(chapterRemaining, chapterBudgetMs)}
        running={timer.running}
        onToggleTimer={timer.toggle}
        onResetTimer={timer.reset}
        onReview={toggleReview}
        startLabel={t('timerStart')}
        pauseLabel={t('timerPause')}
        resetLabel={t('timerReset')}
        reviewLabel={t('timerReview')}
      />

      {showReview && !showSettings ? (
        <RehearsalPanel
          text={activeTab.text}
          tabId={activeTab.id}
          byChapter={timer.byChapter}
          chapterBudgets={config.chapterBudgets}
          pitchSeconds={config.pitchSeconds}
          totalMs={timer.totalMs}
          onClose={toggleReview}
        />
      ) : null}

      {showSettings ? (
        <Settings
          config={config}
          setConfig={setConfig}
          onClose={toggleSettings}
          appVersion={updater.appVersion}
          updateAvailable={updater.updateAvailable}
          updateVersion={updater.updateVersion}
          onUpdateInstall={handleUpdateClick}
        />
      ) : (
        <TextEditor
          key={activeTab.id}
          config={config}
          text={activeTab.text}
          onTextChange={updateText}
          editorRef={editorRef}
          navWidth={navWidth}
          onNavWidthChange={setNavWidth}
          onActiveChapterChange={setActiveChapter}
          tabId={activeTab.id}
          initialScroll={scrollByTab.current[activeTab.id] ?? 0}
          onScrollPosition={rememberScroll}
          onChapterBudget={setChapterBudget}
        />
      )}

      <BottomBar
        config={config}
        setConfig={setConfig}
        isLocked={isLocked}
        onToggleLock={toggleLock}
        onToggleHeading={() => editorRef.current?.toggleKind('heading')}
        onToggleMark={() => editorRef.current?.toggleKind('mark')}
        onToggleNote={() => editorRef.current?.toggleKind('note')}
        onClearText={clearText}
      />
      <div
        className="resize-grip"
        onPointerDown={async (event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          const size = await appWindow.innerSize();
          const scale = await appWindow.scaleFactor();
          resizeDrag.current = {
            x: event.screenX,
            y: event.screenY,
            w: size.width / scale,
            h: size.height / scale,
          };
        }}
        onPointerMove={(event) => {
          const drag = resizeDrag.current;
          if (!drag) return;
          const width = Math.max(MIN_WIDTH, drag.w + (event.screenX - drag.x));
          const height = Math.max(MIN_HEIGHT, drag.h + (event.screenY - drag.y));
          void appWindow.setSize(new LogicalSize(width, height));
        }}
        onPointerUp={() => {
          resizeDrag.current = null;
        }}
      />
    </div>
  );
}

export default App;
