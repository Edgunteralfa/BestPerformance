// MIT License - Copyright (c) 2026 BestPerformance Contributors

import { useEffect, useMemo, useRef, useState } from 'react';
import { visibleText, type NoteTab } from '../types';
import { useI18n } from '../i18n';
import '../styles/PitchSearch.css';

interface PitchSearchProps {
  tabs: NoteTab[];
  excludedTabIds: string[];
  onExcludedChange: (excluded: string[]) => void;
  onJump: (tabId: string, line: number, query: string) => void;
}

interface Hit {
  tabId: string;
  tabName: string;
  line: number;
  text: string;
}

function fold(value: string): string {
  return value.toLocaleLowerCase();
}

function hitsFor(tabs: NoteTab[], query: string): Hit[] {
  const needle = fold(query.trim());
  if (!needle) return [];
  const found: Hit[] = [];
  for (const tab of tabs) {
    const lines = tab.text.split('\n');
    for (let line = 0; line < lines.length; line += 1) {
      const text = visibleText(lines[line] ?? '');
      if (!fold(text).includes(needle)) continue;
      found.push({ tabId: tab.id, tabName: tab.name, line, text: text.trim() || text });
      if (found.length >= 40) return found;
    }
  }
  return found;
}

function Snippet({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  const at = fold(text).indexOf(fold(needle));
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  );
}

function PitchSearch({ tabs, excludedTabIds, onExcludedChange, onJump }: PitchSearchProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const searchable = useMemo(
    () => tabs.filter((tab) => !excludedTabIds.includes(tab.id)),
    [tabs, excludedTabIds],
  );
  const hits = useMemo(() => hitsFor(searchable, query), [searchable, query]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    if (!open && !scopeOpen) return;
    const close = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setScopeOpen(false);
      }
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open, scopeOpen]);

  const jump = (hit: Hit | undefined) => {
    if (!hit) return;
    onJump(hit.tabId, hit.line, query);
    setOpen(false);
  };

  const toggleTab = (tabId: string) => {
    const excluded = new Set(excludedTabIds);
    if (excluded.has(tabId)) excluded.delete(tabId);
    else excluded.add(tabId);
    onExcludedChange([...excluded].filter((id) => tabs.some((tab) => tab.id === id)));
  };

  return (
    <div className="pitch-search" ref={boxRef}>
      <div className="pitch-search-field">
      <input
        className="pitch-search-input"
        value={query}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setSelected((index) => Math.min(hits.length - 1, index + 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelected((index) => Math.max(0, index - 1));
          } else if (event.key === 'Enter') {
            event.preventDefault();
            jump(hits[selected]);
          } else if (event.key === 'Escape') {
            setOpen(false);
            setScopeOpen(false);
          }
        }}
      />
      <button
        type="button"
        className={`pitch-search-scope${scopeOpen ? ' open' : ''}`}
        title={t('searchTabs')}
        aria-label={t('searchTabs')}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setScopeOpen((value) => !value);
          setOpen(false);
        }}
      >
        ▾
      </button>
      </div>
      {scopeOpen ? (
        <ul className="pitch-search-scope-list">
          {tabs.map((tab) => (
            <li key={tab.id}>
              <label>
                <input
                  type="checkbox"
                  checked={!excludedTabIds.includes(tab.id)}
                  onChange={() => toggleTab(tab.id)}
                />
                <span>{tab.name}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim() && !scopeOpen ? (
        <ul className="pitch-search-results">
          {hits.length === 0 ? (
            <li className="pitch-search-empty">{t('searchEmpty')}</li>
          ) : (
            hits.map((hit, index) => (
              <li key={`${hit.tabId}:${hit.line}`}>
                <button
                  type="button"
                  className={`pitch-search-hit${index === selected ? ' selected' : ''}`}
                  onMouseEnter={() => setSelected(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => jump(hit)}
                >
                  <span className="pitch-search-tab">{hit.tabName}</span>
                  <span className="pitch-search-line"><Snippet text={hit.text} query={query} /></span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

export default PitchSearch;
