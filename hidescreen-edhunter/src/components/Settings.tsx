// MIT License - Copyright (c) 2026 BestPerformance Contributors

import { useEffect, useState } from 'react';
import { emit } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-shell';
import { confirm, message } from '@tauri-apps/plugin-dialog';
import type { Config, PitchMemory } from '../types';
import { formatMessage, useI18n, type Language } from '../i18n';
import { formatClock, parseDuration } from '../hooks/usePitchTimer';
import { isMac } from '../platform';
import { TEXT_COLORS, BG_COLORS, FONT_FAMILIES, TAB_COLORS, MAX_PITCH_MEMORIES, MAX_TABS, WINDOW_MASKS, normalizeWindowMask, windowMaskTitle, type NoteTab, type WindowMaskId } from '../types';
import '../styles/Settings.css';

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
  const { t } = useI18n();
  const [opacity, setOpacity] = useState(config.opacity);
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

  useEffect(() => {
    setOpacity(config.opacity);
  }, [config.opacity]);

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
      cardText: config.cardText,
      cardFontSize: config.cardFontSize,
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
      cardText: memory.cardText,
      cardFontSize: memory.cardFontSize,
      pitchMemories: list,
      activePitchId: memory.id,
      pitchEpoch: config.pitchEpoch + 1,
    });
    await emit('pitch-applied', { cardText: memory.cardText, cardFontSize: memory.cardFontSize });
  };

  const saveMemory = async () => {
    const name = memoryName.trim().slice(0, 60);
    if (!name) return;
    const existing = config.pitchMemories.find((item) => item.name.toLowerCase() === name.toLowerCase());
    if (!existing && config.pitchMemories.length >= MAX_PITCH_MEMORIES) {
      await message(t('pitchMemoryFull'), { title: t('pitchMemory'), kind: 'warning' });
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
    const yes = await confirm(formatMessage(t('pitchMemoryDeleteConfirm'), { name: memory.name }), {
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
      await message(formatMessage(t('ethicalNotice'), { app: appName }), {
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
          <label>
            <strong>{t('pitchLength')}</strong>
          </label>
          <p className="settings-hint">{t('pitchHint')}</p>
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
          </div>
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
                    <div className="color-swatches">
                      {TAB_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`color-swatch${memory.tagColor === color ? ' selected' : ''}`}
                          style={{ backgroundColor: color }}
                          onClick={() => { void patchMemory(memory.id, { tagColor: color }); }}
                          title={color}
                        />
                      ))}
                    </div>
                    {current ? (
                      <span className="pitch-memory-current">{t('pitchMemoryCurrent')}</span>
                    ) : (
                      <button type="button" className="button" onClick={() => { void openMemory(memory.id); }}>
                        {t('pitchMemoryOpen')}
                      </button>
                    )}
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
          <p className="settings-hint">{t('opacityHint')}</p>
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
                {FONT_FAMILIES.map((family) => (
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
                  const next = e.target.value === 'ru' ? 'ru' : 'en';
                  setLanguage(next);
                  void setConfig({ language: next });
                }}
                className="font-select"
              >
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </div>
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
