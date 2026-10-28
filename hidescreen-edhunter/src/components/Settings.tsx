// MIT License - Copyright (c) 2026 BestPerformance Contributors

import { useEffect, useState } from 'react';
import { emit } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-shell';
import { open as openFile, save } from '@tauri-apps/plugin-dialog';
import { appConfirm, appMessage } from '../dialogQueue';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { pitchFromFile, pitchToFile, pitchToText } from '../pitchFile';
import { exportPitchPart, parsePitchPart, mergePitchPart, type ImportedPart, type PartKind } from '../pitchParts';
import type { CardChrome, Config, MainChrome, PitchMemory } from '../types';
import { formatMessage, useI18n, type Language } from '../i18n';
import { LANGUAGES, isLanguage } from '../languages';
import { formatClock, parseDuration } from '../hooks/usePitchTimer';
import { isMac } from '../platform';
import { TEXT_COLORS, BG_COLORS, FONT_FAMILIES, TAB_COLORS, MAX_PITCH_MEMORIES, MAX_TABS, WINDOW_MASKS, normalizeWindowMask, windowMaskTitle, type NoteTab, type WindowMaskId } from '../types';
import '../styles/Settings.css';
import { OllamaSettings } from './OllamaSettings';

interface SettingsProps {
  config: Config;
  setConfig: (updates: Partial<Config>) => Promise<void>;
  onClose: () => void;
  appVersion: string;
  updateAvailable: boolean;
  updateVersion: string;
  onUpdateInstall: () => void;
}

function Settings({ config, setConfig, onClose, appVersion, updateAvailable, updateVersion, onUpdateInstall }: SettingsProps) {
  useEffect(() => {
    if (config.mainChrome.sokuji && !config.sokujiLauncherPath) {
      document.getElementById('b25-sokuji-launcher-settings')?.scrollIntoView({ block: 'center' });
    }
  }, [config.mainChrome.sokuji, config.sokujiLauncherPath]);
  const { t } = useI18n();
  const [opacity, setOpacity] = useState(config.opacity);
  const [seenOpacity, setSeenOpacity] = useState(config.opacity);
  if (config.opacity !== seenOpacity) {
    setSeenOpacity(config.opacity);
    setOpacity(config.opacity);
  }
  const [textOpacity, setTextOpacity] = useState(config.textOpacity);
  const [fontFamily, setFontFamily] = useState(config.fontFamily);
  const [fontSize, setFontSize] = useState(config.fontSize);
  const [fontColor, setFontColor] = useState(config.fontColor);
  const [headingColor, setHeadingColor] = useState(config.headingColor);
  const [markColor, setMarkColor] = useState(config.markColor);
  const [noteColor, setNoteColor] = useState(config.noteColor);
  const [bgColor, setBgColor] = useState(config.bgColor);
  const [autoCheckUpdates, setAutoCheckUpdates] = useState(config.autoCheckUpdates);
  const [language, setLanguage] = useState<Language>(config.language);
  const [tabs, setTabs] = useState<NoteTab[]>(config.tabs);
  const [pitchDraft, setPitchDraft] = useState(formatClock(config.pitchSeconds * 1000));
  const [windowMask, setWindowMask] = useState<WindowMaskId>(config.windowMask);
  const [memoryName, setMemoryName] = useState('');
  const [memoryTag, setMemoryTag] = useState('');
  const [memoryTagColor, setMemoryTagColor] = useState(TAB_COLORS[0]);
  const [memoryEdits, setMemoryEdits] = useState<Record<string, { name: string; tag: string }>>({});
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [pitchMenu, setPitchMenu] = useState<{ id: string; kind: 'file' | 'color' } | null>(null);
  const [partialImport, setPartialImport] = useState<{ content: ImportedPart; selected: string[] } | null>(null);
  const [partialExport, setPartialExport] = useState<'questions' | null>(null);
  const [exportSelected, setExportSelected] = useState<string[]>([]);

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setOpacity(value);
    setConfig({ opacity: value }); // Real-time preview
  };

  const handleFontFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFontFamily(value);
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (value >= 8 && value <= 48) {
      setFontSize(value);
    }
  };

  const handleTextColorClick = (color: string) => {
    setFontColor(color);
  };

  const handleBgColorClick = (color: string) => {
    setBgColor(color);
  };

  const handleAutoCheckUpdatesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAutoCheckUpdates(e.target.checked);
  };

  const handleSave = async () => {
    await setConfig({
      opacity,
      textOpacity,
      fontFamily,
      fontSize,
      fontColor,
      headingColor,
      markColor,
      noteColor,
      bgColor,
      autoCheckUpdates,
      language,
      tabs: tabs.map((tab, index) => ({
        ...tab,
        name: tab.name.trim() || `${t('tabDefault')} ${index + 1}`,
      })),
      activeTabId: tabs.some((tab) => tab.id === config.activeTabId) ? config.activeTabId : tabs[0].id,
      readingMode: (tabs.find((tab) => tab.id === config.activeTabId) ?? tabs[0]).readingMode,
      pitchSeconds: parseDuration(pitchDraft) ?? config.pitchSeconds,
      windowMask,
    });
    onClose();
  };

  const handleCancel = async () => {
    // Restore original opacity
    await setConfig({ opacity: config.opacity });
    onClose();
  };

  const takeSnapshot = () => {
    const namedTabs = tabs.map((tab, index) => {
      const live = config.tabs.find((item) => item.id === tab.id);
      return {
        ...tab,
        name: tab.name.trim() || `${t('tabDefault')} ${index + 1}`,
        text: live?.text ?? tab.text,
      };
    });
    const active = namedTabs.find((tab) => tab.id === config.activeTabId) ?? namedTabs[0];
    return {
      tabs: namedTabs,
      activeTabId: active.id,
      pitchSeconds: parseDuration(pitchDraft) ?? config.pitchSeconds,
      chapterBudgets: config.chapterBudgets,
      chapterPaces: config.chapterPaces,
      chapterListColors: config.chapterListColors,
      chapterNavWidths: config.chapterNavWidths,
      cardText: config.cardText,
      cardFontSize: config.cardFontSize,
      searchExcludedTabIds: config.searchExcludedTabIds,
      semanticExcludedTabIds: config.semanticExcludedTabIds,
      contestContext: config.contestContext,
    };
  };

  const keepCurrent = (list: PitchMemory[], openingId: string) => {
    const snapshot = takeSnapshot();
    const current = list.find((item) => item.id === config.activePitchId);
    if (current) {
      return list.map((item) => (
        item.id === current.id ? { ...item, ...snapshot, savedAt: Date.now() } : item
      ));
    }
    const base = snapshot.tabs[0]?.name || t('pitchDraftName');
    const name = list.some((item) => item.name === base)
      ? `${base} ${new Date().toLocaleString()}`.slice(0, 60)
      : base;
    const memory: PitchMemory = {
      ...snapshot,
      id: `pitch-${Date.now()}`,
      name,
      savedAt: Date.now(),
      tag: '',
      tagColor: TAB_COLORS[0],
    };
    if (list.length < MAX_PITCH_MEMORIES) return [...list, memory];
    const drop = list.find((item) => item.id !== openingId);
    const rest = drop ? list.filter((item) => item.id !== drop.id) : list;
    return [...rest, memory];
  };

  const applyMemory = async (list: PitchMemory[], memory: PitchMemory) => {
    const active = memory.tabs.find((tab) => tab.id === memory.activeTabId) ?? memory.tabs[0];
    setTabs(memory.tabs);
    setPitchDraft(formatClock(memory.pitchSeconds * 1000));
    await setConfig({
      tabs: memory.tabs,
      activeTabId: active.id,
      text: active.text,
      pitchSeconds: memory.pitchSeconds,
      chapterBudgets: memory.chapterBudgets,
      chapterPaces: memory.chapterPaces,
      chapterListColors: memory.chapterListColors,
      chapterNavWidths: memory.chapterNavWidths,
      cardText: memory.cardText,
      cardFontSize: memory.cardFontSize,
      searchExcludedTabIds: memory.searchExcludedTabIds,
      semanticExcludedTabIds: memory.semanticExcludedTabIds,
      contestContext: memory.contestContext,
      pitchMemories: list,
      activePitchId: memory.id,
      readingMode: active.readingMode,
      pitchEpoch: config.pitchEpoch + 1,
    });
    await emit('pitch-applied', { cardText: memory.cardText, cardFontSize: memory.cardFontSize });
  };

  const saveMemory = async () => {
    const name = memoryName.trim().slice(0, 60);
    if (!name) return;
    const existing = config.pitchMemories.find((item) => item.name.toLowerCase() === name.toLowerCase());
    if (!existing && config.pitchMemories.length >= MAX_PITCH_MEMORIES) {
      await appMessage(t('pitchMemoryFull'), { title: t('pitchMemory'), kind: 'warning' });
      return;
    }
    const memory: PitchMemory = {
      ...takeSnapshot(),
      id: existing?.id ?? `pitch-${Date.now()}`,
      name,
      savedAt: Date.now(),
      tag: memoryTag.trim().slice(0, 24),
      tagColor: memoryTagColor,
    };
    const list = existing
      ? config.pitchMemories.map((item) => (item.id === memory.id ? memory : item))
      : [...config.pitchMemories, memory];
    await setConfig({ pitchMemories: list, activePitchId: memory.id });
    setMemoryName('');
    setMemoryTag('');
  };

  const liveMemory = (memory: PitchMemory): PitchMemory => (
    memory.id === config.activePitchId
      ? {
        ...memory,
        ...takeSnapshot(),
        name: memory.name,
        tag: memory.tag,
        tagColor: memory.tagColor,
        id: memory.id,
        savedAt: memory.savedAt,
      }
      : memory
  );

  const exportMemory = async (memory: PitchMemory) => {
    const live = liveMemory(memory);
    const safe = live.name.replace(/[<>:"/\\|?*]/g, ' ').trim() || 'pitch';
    const path = await save({
      defaultPath: `${safe}.bestperformance.json`,
      filters: [{ name: 'BestPerformance', extensions: ['json'] }],
    });
    if (typeof path !== 'string') return;
    await writeTextFile(path, pitchToFile(live));
  };

  const exportText = async (memory: PitchMemory) => {
    const live = liveMemory(memory);
    const safe = live.name.replace(/[<>:"/\\|?*]/g, ' ').trim() || 'pitch';
    const path = await save({
      defaultPath: `${safe}.txt`,
      filters: [
        { name: 'Text', extensions: ['txt'] },
        { name: 'Markdown', extensions: ['md'] },
      ],
    });
    if (typeof path !== 'string') return;
    await writeTextFile(path, pitchToText(live));
  };

  const importMemory = async () => {
    const picked = await openFile({
      multiple: false,
      filters: [{ name: 'BestPerformance', extensions: ['json'] }],
    });
    if (typeof picked !== 'string') return;
    const pitch = pitchFromFile(await readTextFile(picked));
    if (!pitch) {
      await appMessage(t('pitchFileBad'), { title: t('pitchMemory'), kind: 'warning' });
      return;
    }
    if (config.pitchMemories.length >= MAX_PITCH_MEMORIES) {
      await appMessage(t('pitchMemoryFull'), { title: t('pitchMemory'), kind: 'warning' });
      return;
    }
    let name = pitch.name;
    const taken = new Set(config.pitchMemories.map((item) => item.name.toLowerCase()));
    if (taken.has(name.toLowerCase())) {
      let n = 2;
      while (taken.has(`${name} ${n}`.toLowerCase())) n += 1;
      name = `${name} ${n}`.slice(0, 60);
    }
    await setConfig({
      pitchMemories: [...config.pitchMemories, { ...pitch, id: `pitch-${Date.now()}`, name, savedAt: Date.now() }],
    });
  };

  const loadPart = async (kind: PartKind) => {
    if (!config.activePitchId || !config.pitchMemories.some(p => p.id === config.activePitchId)) {
      await appMessage('Сначала сохрани и выбери конкурс в списке питчдеков.', { title: 'Частичный импорт', kind: 'warning' });
      return;
    }
    const file = await openFile({ multiple: false, filters: [{ name: 'BestPerformance JSON', extensions: ['json'] }] });
    if (typeof file !== 'string') return;
    const payload = parsePitchPart(await readTextFile(file), kind);
    if (!payload?.tabs.length) {
      await appMessage('Не найдено подходящих вкладок. Используй JSON BestPerformance либо экспортированную часть.', { title: 'Частичный импорт', kind: 'warning' });
      return;
    }
    setPartialImport({ content: payload, selected: payload.tabs.map(tab => tab.id) });
  };
  const commitPart = async () => {
    if (!partialImport || !config.activePitchId) return;
    const target = config.pitchMemories.find(p => p.id === config.activePitchId);
    if (!target) return;
    let merged: PitchMemory;
    try { merged = mergePitchPart(liveMemory(target), partialImport.content, partialImport.selected); }
    catch (error) { await appMessage(String(error), { title: 'Частичный импорт', kind: 'warning' }); return; }
    const selectedNames = partialImport.content.tabs
      .filter(t => partialImport.selected.includes(t.id)).map(t => t.name).join(', ');
    const confirmed = await appConfirm(
      `Конкурс: ${target.name}\nИсточник JSON: ${partialImport.content.name || 'Без названия'}\nЗаменить выбранные данные (${selectedNames})? Остальные вкладки и контекст конкурса сохранятся.`,
      { title: 'Подтвердить частичный импорт', kind: 'warning' },
    );
    if (!confirmed) return;
    const list = config.pitchMemories.map(p => p.id === target.id ? merged : p);
    await applyMemory(list, merged);
    setPartialImport(null);
  };
  const savePart = async (kind: PartKind, selected?: string[]) => {
    const target = config.pitchMemories.find(p => p.id === config.activePitchId);
    if (!target) return;
    const live = liveMemory(target);
    const ids = selected ?? live.tabs.slice(1).map(t => t.id);
    try {
      const destination = await save({
        defaultPath: `${live.name.replace(/[<>:"/\\|?*]/g, ' ').trim() || 'competition'}-${kind}.json`,
        filters: [{ name: 'BestPerformance JSON', extensions: ['json'] }],
      });
      if (typeof destination === 'string') await writeTextFile(destination, exportPitchPart(live, kind, ids));
    } catch (error) { await appMessage(String(error), { title: 'Экспорт части конкурса', kind: 'warning' }); }
  };

  const patchMemory = async (id: string, patch: Partial<Pick<PitchMemory, 'name' | 'tag' | 'tagColor'>>) => {
    await setConfig({
      pitchMemories: config.pitchMemories.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  };

  const commitMemoryLabel = async (id: string) => {
    const edit = memoryEdits[id];
    const memory = config.pitchMemories.find((item) => item.id === id);
    setMemoryEdits((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    if (!edit || !memory) return;
    const name = edit.name.trim().slice(0, 60);
    const tag = edit.tag.trim().slice(0, 24);
    if (!name || (name === memory.name && tag === memory.tag)) return;
    await patchMemory(id, { name, tag });
  };

  const openMemory = async (id: string) => {
    if (id === config.activePitchId) return;
    const list = keepCurrent(config.pitchMemories, id);
    const memory = list.find((item) => item.id === id);
    if (!memory) return;
    await applyMemory(list, memory);
  };

  const deleteMemory = async (id: string) => {
    const memory = config.pitchMemories.find((item) => item.id === id);
    if (!memory) return;
    const yes = await appConfirm(formatMessage(t('pitchMemoryDeleteConfirm'), { name: memory.name }), {
      title: t('pitchMemoryDeleteTitle'),
      kind: 'warning',
    });
    if (!yes) return;
    await setConfig({
      pitchMemories: config.pitchMemories.filter((item) => item.id !== id),
      activePitchId: config.activePitchId === id ? null : config.activePitchId,
    });
  };

  const handleDocsClick = async () => {
    await open('https://github.com/Edgunteralfa/BestPerformance');
  };

  const handleShowNotice = async () => {
    try {
      const appName = isMac ? windowMaskTitle(config.windowMask) : 'BestPerformance';
      await appMessage(formatMessage(t('ethicalNotice'), { app: appName }), {
        title: formatMessage(t('noticeTitle'), { app: appName }),
        kind: 'warning',
      });
    } catch (error) {
      console.error('Failed to show notice:', error);
    }
  };

  return (
    <div className="settings">
      <div className="settings-header">
        <h2>{t('settings')}</h2>
        <button className="close-button" onClick={handleCancel}>
          ✕
        </button>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={config.cursorCloak}
              onChange={() => {
                const enabled = !config.cursorCloak;
                void setConfig({ cursorCloak: enabled });
                void emit('cursor-cloak', enabled);
              }}
            />
            <strong>{t('cursorCloak')}</strong>
          </label>
          <p className="settings-hint">{t('cursorCloakHint')}</p>
        </div>
        <div className="settings-section">
          <label>
            <strong>{t('chromeTitle')}</strong>
          </label>
          <p className="settings-hint">{t('chromeHint')}</p>
          <p className="chrome-group">{t('chromeMain')}</p>
          <div className="chrome-grid">
            {([
              ['opacity', 'chromeOpacity'],
              ['card', 'chromeCardButton'],
              ['tabs', 'chromeTabs'],
              ['search', 'chromeSearch'],
              ['timer', 'chromeTimer'],
              ['minuteCue', 'chromeMinuteCue'],
              ['thirtyCue', 'chromeThirtyCue'],
              ['chapters', 'chromeChapters'],
              ['fontSize', 'chromeFontSize'],
              ['heading', 'chromeHeading'],
              ['marks', 'chromeMarks'],
              ['clear', 'chromeClear'],
              ['blind', 'chromeBlind'],
              ['lock', 'chromeLock'],
              ['reading', 'chromeReading'],
              ['sokuji', 'chromeReading'],
            ] as const).map(([key, label]) => (
              <label key={key} className="chrome-row">
                <input
                  type="checkbox"
                  checked={config.mainChrome[key]}
                  onChange={() => {
                    const next: MainChrome = { ...config.mainChrome, [key]: !config.mainChrome[key] };
                    void setConfig({ mainChrome: next });
                  }}
                />
                {key === 'sokuji' ? (config.language === 'ru' ? 'Кнопка Sokuji в заголовке' : 'Sokuji launcher in title bar') : t(label)}
              </label>
            ))}
          </div>
          <div className="b25-sokuji-config" id="b25-sokuji-launcher-settings">
            <label htmlFor="b25-sokuji-launcher"><strong>Sokuji — путь к программе</strong></label>
            <p className="settings-hint">Используется кнопкой Sokuji в заголовке. При отсутствии пути кнопка открывает настройки. Поддерживаются локальные .exe и .bat.</p>
            <div className="b25-sokuji-config__row">
              <input id="b25-sokuji-launcher" value={config.sokujiLauncherPath}
                placeholder="Выбрать Sokuji.exe или START_B25_SOKUJI.bat"
                onChange={event => { void setConfig({ sokujiLauncherPath: event.target.value.slice(0, 800) }); }}/>
              <button type="button" onClick={() => void (async () => {
                const chosen = await openFile({ multiple: false, directory: false, filters: [
                  { name: 'Sokuji launcher', extensions: ['exe', 'bat', 'cmd'] },
                ] });
                if (typeof chosen === 'string') void setConfig({ sokujiLauncherPath: chosen });
              })()}>Обзор…</button>
            </div>
          </div>
          <p className="chrome-group">{t('chromeCard')}</p>
          <div className="chrome-grid">
            {([
              ['opacity', 'chromeOpacity'],
              ['fontSize', 'chromeFontSize'],
              ['heading', 'chromeHeading'],
              ['marks', 'chromeMarks'],
            ] as const).map(([key, label]) => (
              <label key={key} className="chrome-row">
                <input
                  type="checkbox"
                  checked={config.cardChrome[key]}
                  onChange={() => {
                    const next: CardChrome = { ...config.cardChrome, [key]: !config.cardChrome[key] };
                    void setConfig({ cardChrome: next });
                  }}
                />
                {t(label)}
              </label>
            ))}
          </div>
        </div>
        <div className="settings-section">
          <label>
            <strong>{t('pitchLength')}</strong>
          </label>
          <p className="settings-hint">{t('pitchHint')}</p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={config.glideWithTimer}
              onChange={(event) => {
                void setConfig({ glideWithTimer: event.target.checked });
              }}
            />
            {t('glideWithTimer')}
          </label>
          <p className="settings-hint">{t('glideWithTimerHint')}</p>
          <input
            className="pitch-length-input"
            value={pitchDraft}
            inputMode="numeric"
            onChange={(event) => setPitchDraft(event.target.value)}
          />
        </div>
        <div className="settings-section">
          <label>
            <strong>{t('pitchMemory')}</strong>
          </label>
          <p className="settings-hint">{t('pitchMemoryHint')}</p>
          <div className="pitch-memory-save">
            <input
              className="pitch-memory-name"
              value={memoryName}
              maxLength={60}
              placeholder={t('pitchMemoryName')}
              onChange={(event) => setMemoryName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void saveMemory();
              }}
            />
            <input
              className="pitch-memory-tag"
              style={{ backgroundColor: memoryTagColor, borderColor: memoryTagColor }}
              value={memoryTag}
              maxLength={24}
              placeholder={t('pitchMemoryTag')}
              onChange={(event) => setMemoryTag(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void saveMemory();
              }}
            />
            <div className="color-swatches">
              {TAB_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-swatch${memoryTagColor === color ? ' selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setMemoryTagColor(color)}
                  title={color}
                />
              ))}
            </div>
            <button type="button" className="button" onClick={() => { void saveMemory(); }}>
              {t('pitchMemorySave')}
            </button>
            <button type="button" className="button" onClick={() => { void importMemory(); }}>
              Загрузить всё (новый конкурс)
            </button>
            <button type="button" className="button" disabled={!config.activePitchId}
              onClick={() => { void loadPart('pitch'); }}>Заменить только питч</button>
            <button type="button" className="button" disabled={!config.activePitchId}
              onClick={() => { void loadPart('questions'); }}>Обновить вопросы / вкладки</button>
            <button type="button" className="button" disabled={!config.activePitchId}
              onClick={() => { void savePart('pitch'); }}>Экспорт только питча</button>
            <button type="button" className="button" disabled={!config.activePitchId}
              onClick={() => {
                const current = config.pitchMemories.find(p => p.id === config.activePitchId);
                setExportSelected(current?.tabs.slice(1).map(t => t.id) ?? []);
                setPartialExport('questions');
              }}>Экспорт вопросов…</button>
          </div>
          {partialImport && (
            <div className="bp-partial-import" role="region" aria-label="Предпросмотр частичного импорта">
              <strong>Импорт в текущий конкурс: {partialImport.content.kind === 'pitch' ? 'питчдек' : 'вопросы'}</strong>
              <p>JSON: {partialImport.content.name || 'без названия'} · Выбери, какие вкладки заменить или добавить. Остальные данные не изменятся.</p>
              {partialImport.content.tabs.map(tab => (
                <label key={tab.id}><input type="checkbox"
                  checked={partialImport.selected.includes(tab.id)}
                  onChange={event => setPartialImport(prev => prev && ({
                    ...prev, selected: event.target.checked
                      ? [...prev.selected, tab.id]
                      : prev.selected.filter(id => id !== tab.id),
                  }))} />{tab.name} · {tab.text.length.toLocaleString()} знаков</label>
              ))}
              <div className="bp-partial-import__actions">
                <button type="button" disabled={!partialImport.selected.length} onClick={() => { void commitPart(); }}>Применить выбранное</button>
                <button type="button" onClick={() => setPartialImport(null)}>Отмена</button>
              </div>
            </div>
          )}
          {partialExport && (
            <div className="bp-partial-import" role="region" aria-label="Экспорт выбранных вопросов">
              <strong>Экспорт списка вопросов отдельным JSON</strong>
              {config.pitchMemories.find(p => p.id === config.activePitchId)?.tabs.slice(1).map(tab => (
                <label key={tab.id}><input type="checkbox" checked={exportSelected.includes(tab.id)}
                  onChange={event => setExportSelected(ids => event.target.checked ? [...ids, tab.id] : ids.filter(id => id !== tab.id))} />{tab.name}</label>
              ))}
              <div className="bp-partial-import__actions">
                <button type="button" disabled={!exportSelected.length} onClick={() => {
                  void savePart('questions', exportSelected).then(() => setPartialExport(null));
                }}>Сохранить JSON</button>
                <button type="button" onClick={() => setPartialExport(null)}>Отмена</button>
              </div>
            </div>
          )}
          {config.pitchMemories.length > 0 && (
            <ul className="pitch-memory-list">
              {config.pitchMemories.map((memory) => {
                const current = memory.id === config.activePitchId;
                const edit = memoryEdits[memory.id];
                const name = edit?.name ?? memory.name;
                const tag = edit?.tag ?? memory.tag;
                return (
                  <li key={memory.id} className="pitch-memory-row">
                    <input
                      className="pitch-memory-title"
                      value={name}
                      maxLength={60}
                      aria-label={t('pitchMemoryName')}
                      onChange={(event) => {
                        const nextName = event.target.value;
                        setMemoryEdits((rows) => ({ ...rows, [memory.id]: { name: nextName, tag } }));
                      }}
                      onBlur={() => { void commitMemoryLabel(memory.id); }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur();
                      }}
                    />
                    {editingTagId === memory.id ? (
                      <input
                        className="pitch-memory-tag"
                        style={{ backgroundColor: memory.tagColor, borderColor: memory.tagColor }}
                        value={tag}
                        maxLength={24}
                        placeholder={t('pitchMemoryTag')}
                        aria-label={t('pitchMemoryTag')}
                        autoFocus
                        onChange={(event) => {
                          const nextTag = event.target.value;
                          setMemoryEdits((rows) => ({ ...rows, [memory.id]: { name, tag: nextTag } }));
                        }}
                        onBlur={() => {
                          setEditingTagId(null);
                          void commitMemoryLabel(memory.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') event.currentTarget.blur();
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className={`pitch-memory-chip${memory.tag ? '' : ' is-empty'}`}
                        style={{ backgroundColor: memory.tagColor }}
                        onClick={() => {
                          setMemoryEdits((rows) => ({
                            ...rows,
                            [memory.id]: {
                              name: rows[memory.id]?.name ?? memory.name,
                              tag: rows[memory.id]?.tag ?? memory.tag,
                            },
                          }));
                          setEditingTagId(memory.id);
                        }}
                      >
                        {memory.tag || t('pitchMemoryTag')}
                      </button>
                    )}
                    <div className="pitch-menu">
                      <button
                        type="button"
                        className="color-swatch"
                        style={{ backgroundColor: memory.tagColor }}
                        title={t('pitchMemoryColor')}
                        aria-label={t('pitchMemoryColor')}
                        onClick={() => setPitchMenu((menu) => (
                          menu?.id === memory.id && menu.kind === 'color' ? null : { id: memory.id, kind: 'color' }
                        ))}
                      />
                      {pitchMenu?.id === memory.id && pitchMenu.kind === 'color' ? (
                        <div className="pitch-menu-list color-swatches">
                          {TAB_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className={`color-swatch${memory.tagColor === color ? ' selected' : ''}`}
                              style={{ backgroundColor: color }}
                              onClick={() => {
                                void patchMemory(memory.id, { tagColor: color });
                                setPitchMenu(null);
                              }}
                              title={color}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {current ? (
                      <span className="pitch-memory-current">{t('pitchMemoryCurrent')}</span>
                    ) : (
                      <button type="button" className="button" onClick={() => { void openMemory(memory.id); }}>
                        {t('pitchMemoryOpen')}
                      </button>
                    )}
                    <div className="pitch-menu">
                      <button
                        type="button"
                        className="button"
                        onClick={() => setPitchMenu((menu) => (
                          menu?.id === memory.id && menu.kind === 'file' ? null : { id: memory.id, kind: 'file' }
                        ))}
                      >
                        {t('pitchFileMenu')}
                      </button>
                      {pitchMenu?.id === memory.id && pitchMenu.kind === 'file' ? (
                        <div className="pitch-menu-list">
                          <button type="button" onClick={() => { setPitchMenu(null); void exportMemory(memory); }}>
                            {t('pitchFileExport')}
                          </button>
                          <button type="button" onClick={() => { setPitchMenu(null); void exportText(memory); }}>
                            {t('pitchFileText')}
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <button type="button" className="tab-remove" onClick={() => { void deleteMemory(memory.id); }}>
                      {t('pitchMemoryDelete')}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="settings-section">
          <label>
            <strong>{t('tabs')}</strong>
          </label>
          <p className="settings-hint tab-hint">{t('tabHint')}</p>
          {tabs.map((tab) => (
            <div key={tab.id} className="tab-editor">
              <input
                className="tab-name-input"
                value={tab.name}
                maxLength={40}
                onChange={(event) => {
                  const name = event.target.value;
                  setTabs((current) => current.map((item) => (item.id === tab.id ? { ...item, name } : item)));
                }}
              />
              <div className="color-swatches">
                {TAB_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch${tab.color === color ? ' selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      setTabs((current) => current.map((item) => (item.id === tab.id ? { ...item, color } : item)));
                    }}
                    title={color}
                  />
                ))}
              </div>
              {tabs.length > 1 && (
                <button
                  type="button"
                  className="tab-remove"
                  onClick={() => setTabs((current) => current.filter((item) => item.id !== tab.id))}
                >
                  {t('removeTab')}
                </button>
              )}
            </div>
          ))}
          {tabs.length < MAX_TABS && (
            <button
              type="button"
              className="tab-add"
              onClick={() => {
                setTabs((current) => [
                  ...current,
                  {
                    id: `tab-${Date.now()}`,
                    name: `${t('tabDefault')} ${current.length + 1}`,
                    color: TAB_COLORS[current.length % TAB_COLORS.length],
                    text: '',
                    readingMode: 'outline',
                  },
                ]);
              }}
            >
              {t('addTab')}
            </button>
          )}
        </div>

        {/* Opacity */}
        <div className="settings-section">
          <label>
            <strong>{t('opacity')}</strong>
            <span className="opacity-value">{Math.round(opacity * 100)}%</span>
          </label>
          <input
            type="range"
            min="0.5"
            max="1"
            step="0.05"
            value={opacity}
            onChange={handleOpacityChange}
            className="opacity-slider"
          />
          <p className="settings-hint">Прозрачность фона (ползунок заголовка и настроек синхронизированы). Тексты сохраняют независимую яркость.</p>
          <label><strong>Непрозрачность текста и заголовков</strong><span className="opacity-value">{Math.round(textOpacity * 100)}%</span></label>
          <input type="range" min="0.5" max="1" step="0.05" value={textOpacity}
            aria-label="Непрозрачность текста и заголовков"
            onChange={event => { const value = Number(event.target.value); setTextOpacity(value); void setConfig({ textOpacity: value }); }}
            className="opacity-slider" />
        </div>

        {/* Font */}
        <div className="settings-section">
          <label>
            <strong>{t('font')}</strong>
          </label>
          <div className="font-controls">
            <div className="font-row">
              <span className="font-label">{t('fontFamily')}</span>
              <select value={fontFamily} onChange={handleFontFamilyChange} className="font-select">
                {[...FONT_FAMILIES].sort((a, b) => (
                  a.split(',')[0].replace(/['"]/g, '').localeCompare(b.split(',')[0].replace(/['"]/g, ''), undefined, { sensitivity: 'base' })
                )).map((family) => (
                  <option key={family} value={family}>
                    {family.split(',')[0].replace(/['"]/g, '')}
                  </option>
                ))}
              </select>
            </div>
            <div className="font-row">
              <span className="font-label">{t('fontSize')}</span>
              <input
                type="number"
                min="8"
                max="48"
                value={fontSize}
                onChange={handleFontSizeChange}
                className="font-size-input"
              />
              <span className="font-unit">{t('fontUnit')}</span>
            </div>
          </div>
        </div>

        {/* Text Color */}
        <div className="settings-section">
          <label>
            <strong>{t('textColor')}</strong>
          </label>
          <div className="color-palette">
            <div className="current-color" style={{ backgroundColor: fontColor }} />
            <div className="color-swatches">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  className="color-swatch"
                  style={{ backgroundColor: color }}
                  onClick={() => handleTextColorClick(color)}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="settings-section">
          <label>
            <strong>{t('headingColor')}</strong>
          </label>
          <div className="color-palette">
            <div className="current-color" style={{ backgroundColor: headingColor }} />
            <div className="color-swatches">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  className="color-swatch"
                  style={{ backgroundColor: color }}
                  onClick={() => setHeadingColor(color)}
                  title={color}
                />
              ))}
            </div>
          </div>
          <p className="settings-hint">{t('headingHint')}</p>
        </div>

        <div className="settings-section">
          <label>
            <strong>{t('markColor')}</strong>
          </label>
          <div className="color-palette">
            <div className="current-color" style={{ backgroundColor: markColor }} />
            <div className="color-swatches">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  className="color-swatch"
                  style={{ backgroundColor: color }}
                  onClick={() => setMarkColor(color)}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="settings-section">
          <label>
            <strong>{t('noteColor')}</strong>
          </label>
          <div className="color-palette">
            <div className="current-color" style={{ backgroundColor: noteColor }} />
            <div className="color-swatches">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  className="color-swatch"
                  style={{ backgroundColor: color }}
                  onClick={() => setNoteColor(color)}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Background Color */}
        <div className="settings-section">
          <label>
            <strong>{t('backgroundColor')}</strong>
          </label>
          <div className="color-palette">
            <div className="current-color" style={{ backgroundColor: bgColor }} />
            <div className="color-swatches">
              {BG_COLORS.map((color) => (
                <button
                  key={color}
                  className="color-swatch"
                  style={{ backgroundColor: color }}
                  onClick={() => handleBgColorClick(color)}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Updates */}
        <div className="settings-section">
          <label>
            <strong>{t('updates')}</strong>
          </label>
          <div className="updates-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={autoCheckUpdates}
                onChange={handleAutoCheckUpdatesChange}
              />
              {t('checkUpdates')}
            </label>
          </div>
        </div>
        <div className="settings-section">
          <label>
            <strong>{t('altTab')}</strong>
          </label>
          <p className="settings-hint">{t('altTabHint')}</p>
          <select
            className="font-select mask-select"
            value={windowMask}
            onChange={(event) => setWindowMask(normalizeWindowMask(event.target.value))}
          >
            {WINDOW_MASKS.map((mask) => (
              <option key={mask.id} value={mask.id}>{windowMaskTitle(mask.id)}</option>
            ))}
          </select>
        </div>
        {/* Keyboard Layout */}
        <div className="settings-section">
          <label>
            <strong>{t('language')}</strong>
          </label>
          <div className="font-controls">
            <div className="font-row">
              <select
                value={language}
                onChange={(e) => {
                  const next: Language = isLanguage(e.target.value) ? e.target.value : language;
                  setLanguage(next);
                  void setConfig({ language: next });
                }}
                className="font-select"
              >
                {LANGUAGES.map((item) => (
                  <option key={item.id} value={item.id}>{item.native}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <OllamaSettings
          value={config.semantic}
          onChange={semantic => { void setConfig({ semantic }); }}
          contestContext={config.contestContext}
          onContestContextChange={contestContext => { void setConfig({ contestContext }); }}
          tabs={config.tabs}
          excludedTabIds={config.semanticExcludedTabIds}
          onSourcesChange={(excluded) => {
            const pitchMemories = config.activePitchId
              ? config.pitchMemories.map(item => item.id === config.activePitchId
                ? { ...item, semanticExcludedTabIds: excluded } : item)
              : config.pitchMemories;
            void setConfig({ semanticExcludedTabIds: excluded, pitchMemories });
          }}
        />
      </div>

      <div className="settings-version-info">
        <span className="version-label">v{appVersion}</span>
        {updateAvailable ? (
          <button className="version-update-link" onClick={onUpdateInstall}>
            {formatMessage(t('updateInstall'), { version: updateVersion })}
          </button>
        ) : (
          <span className="version-up-to-date">{t('upToDate')}</span>
        )}
      </div>

      <div className="settings-footer">
        {isMac ? null : (
          <button className="docs-link" onClick={handleDocsClick}>
            {t('docs')}
          </button>
        )}
        <button className="docs-link" onClick={handleShowNotice}>
          {t('notice')}
        </button>
        <div className="footer-spacer" />
        <button className="button cancel-button" onClick={handleCancel}>
          {t('cancel')}
        </button>
        <button className="button save-button" onClick={handleSave}>
          {t('save')}
        </button>
      </div>
    </div>
  );
}

export default Settings;
