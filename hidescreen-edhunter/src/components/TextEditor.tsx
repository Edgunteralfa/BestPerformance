// MIT License - Copyright (c) 2026 BestPerformance Contributors

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type RefObject } from 'react';
import { formatClock, parseDuration } from '../hooks/usePitchTimer';
import { applyWordInk, fillEditor, inkRuns, paintLine, parseText, readLines, serialize, toggleLineKind, type LineKind } from '../lineMarkup';
import { chapterSpan, EYE_RATIO, glidePixelsPerSecond, glideSeconds, isCommentLine, spokenHeight } from '../reading';
import { CHAPTER_LIST_COLORS, chapterBudgetKey, visibleText, type Config, type ReadingMode } from '../types';
import WordInkMenu from './WordInkMenu';
import { useI18n } from '../i18n';
import '../styles/TextEditor.css';

interface TextEditorProps {
  config: Config;
  text: string;
  onTextChange: (text: string) => void;
  editorRef: RefObject<TextEditorHandle | null>;
  navWidth: number;
  onNavWidthChange: (width: number) => void;
  onNavWidthCommit: (width: number) => void;
  onActiveChapterChange: (index: number | null) => void;
  tabId: string;
  readScroll: (tabId: string) => number;
  onScrollPosition: (tabId: string, top: number) => void;
  onChapterBudget: (heading: string, seconds: number | null) => void;
  onChapterListColor: (heading: string, color: string | null) => void;
  queuedReveal: { line: number; query: string } | null;
  onRevealConsumed: () => void;
  blind: boolean;
  peek: boolean;
  showChapters: boolean;
  readingMode: ReadingMode;
  glideOn: boolean;
  glideHeld: boolean;
  onGlideHold: (held: boolean) => void;
  onGlidePause: () => void;
}

export type { LineKind };

export interface TextEditorHandle {
  toggleKind: (kind: Exclude<LineKind, 'body'>) => void;
  moveChapter: (direction: 1 | -1) => void;
  moveReading: (direction: 1 | -1) => void;
  revealLine: (index: number, query?: string) => void;
  readingIndex: () => number | null;
  ensureReading: () => void;
  atLastChapter: () => boolean;
}

function clearSearchFlash(root: HTMLElement) {
  root.querySelectorAll('mark.search-flash').forEach((mark) => {
    mark.replaceWith(document.createTextNode(mark.textContent ?? ''));
  });
  root.normalize();
}

function flashMatches(line: HTMLElement, query: string) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return;
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  for (const textNode of nodes) {
    const value = textNode.data;
    const folded = value.toLocaleLowerCase();
    const fragment = document.createDocumentFragment();
    let from = 0;
    let found = false;
    while (from < value.length) {
      const at = folded.indexOf(needle, from);
      if (at < 0) {
        fragment.append(value.slice(from));
        break;
      }
      found = true;
      if (at > from) fragment.append(value.slice(from, at));
      const mark = document.createElement('mark');
      mark.className = 'search-flash';
      mark.textContent = value.slice(at, at + needle.length);
      fragment.append(mark);
      from = at + needle.length;
    }
    if (found) textNode.replaceWith(fragment);
  }
}

function markReading(root: HTMLElement, index: number | null) {
  root.querySelectorAll<HTMLElement>('.line').forEach((node, lineIndex) => {
    node.classList.toggle('reading', lineIndex === index);
  });
}

function ChapterBudgetField({ seconds, onCommit }: { seconds: number | undefined; onCommit: (seconds: number | null) => void }) {
  const formatted = seconds ? formatClock(seconds * 1000) : '';
  const [draft, setDraft] = useState(formatted);
  const [seenSeconds, setSeenSeconds] = useState(formatted);
  if (formatted !== seenSeconds) {
    setSeenSeconds(formatted);
    setDraft(formatted);
  }

  return (
    <input
      className="chapter-budget"
      value={draft}
      inputMode="numeric"
      placeholder="0:00"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const parsed = parseDuration(draft);
        if (!draft.trim() || parsed === 0) {
          onCommit(null);
          setDraft('');
          return;
        }
        if (parsed === null) {
          setDraft(seconds ? formatClock(seconds * 1000) : '');
          return;
        }
        onCommit(parsed);
        setDraft(formatClock(parsed * 1000));
      }}
    />
  );
}

function TextEditor({ config, text, onTextChange, editorRef, navWidth, onNavWidthChange, onNavWidthCommit, onActiveChapterChange, tabId, readScroll, onScrollPosition, onChapterBudget, onChapterListColor, queuedReveal, onRevealConsumed, blind, peek, showChapters, readingMode, glideOn, glideHeld, onGlideHold, onGlidePause }: TextEditorProps) {
  const { t } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);
  const serializedRef = useRef(text);
  const pendingScroll = useRef<number | null>(null);
  const readingRef = useRef<number | null>(null);
  const [colorMenu, setColorMenu] = useState<{ heading: string; x: number; y: number } | null>(null);
  const [wordMenu, setWordMenu] = useState<{ x: number; y: number } | null>(null);
  const wordRange = useRef<Range | null>(null);
  const flashTimer = useRef<number | null>(null);
  const programmaticScroll = useRef(false);
  const activeChapterRef = useRef<number | null>(null);

  useEffect(() => {
    if (!colorMenu) return;
    const close = () => setColorMenu(null);
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [colorMenu]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (text === serializedRef.current && root.childElementCount > 0) {
      for (const block of root.children) {
        if (!(block instanceof HTMLElement)) continue;
        paintLine(
          block,
          { kind: (block.dataset.kind as LineKind | undefined) ?? 'body', text: block.textContent ?? '' },
          config,
        );
      }
    } else {
      fillEditor(root, parseText(text), config);
      serializedRef.current = text;
    }
    markReading(root, readingRef.current);
    if (pendingScroll.current === null) pendingScroll.current = readScroll(tabId);
    const target = pendingScroll.current;
    if (target < 0) return;
    const apply = () => {
      root.scrollTop = target;
    };
    apply();
    if (target > 0 && root.scrollTop + 1 < target) {
      requestAnimationFrame(apply);
    }
    pendingScroll.current = -1;
  }, [text, config, readScroll, tabId]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const remember = () => {
      onScrollPosition(tabId, root.scrollTop);
      if (!programmaticScroll.current && readingMode === 'glide' && glideOn && !glideHeld) {
        onGlidePause();
      }
    };
    root.addEventListener('scroll', remember, { passive: true });
    return () => root.removeEventListener('scroll', remember);
  }, [onScrollPosition, tabId, readingMode, glideOn, glideHeld, onGlidePause]);

  const publish = () => {
    const root = rootRef.current;
    if (!root) return;
    const next = serialize(readLines(root));
    serializedRef.current = next;
    onTextChange(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const block = document.createElement('div');
    block.className = 'line';
    paintLine(block, { kind: 'body', text: '' }, config);
    block.appendChild(document.createElement('br'));
    const current = range.startContainer instanceof HTMLElement
      ? range.startContainer
      : range.startContainer.parentElement;
    const line = current?.closest('.line');
    if (line && line.parentElement === rootRef.current) {
      line.after(block);
    } else {
      rootRef.current?.appendChild(block);
    }
    const caret = document.createRange();
    caret.setStart(block, 0);
    caret.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caret);
    publish();
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const plain = event.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, plain);
    publish();
  };

  const isEmpty = text.length === 0;
  const chapters = useMemo(
    () => parseText(text)
      .map((line, index) => ({ index, text: visibleText(line.text).trim(), source: line.text, kind: line.kind }))
      .filter((line) => line.kind === 'heading' && line.text.length > 0),
    [text],
  );
  const [activeChapter, setActiveChapter] = useState<number | null>(null);
  const keepChapter = (index: number | null) => {
    activeChapterRef.current = index;
    setActiveChapter((previous) => (previous === index ? previous : index));
  };
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || readingMode !== 'outline') return;
    const sync = () => {
      const nodes = root.querySelectorAll<HTMLElement>('.line');
      let current = chapters[0]?.index ?? null;
      for (const chapter of chapters) {
        const node = nodes[chapter.index];
        if (node && node.offsetTop <= root.scrollTop + 8) current = chapter.index;
      }
      keepChapter(current);
    };
    sync();
    root.addEventListener('scroll', sync);
    return () => root.removeEventListener('scroll', sync);
  }, [chapters, readingMode]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const fit = () => {
      const line = root.querySelector<HTMLElement>('.line');
      const lineHeight = line?.offsetHeight ?? Math.round(config.fontSize * 1.5);
      if (readingMode === 'glide') {
        root.style.paddingTop = `${Math.round(root.clientHeight * EYE_RATIO)}px`;
        root.style.paddingBottom = `${Math.round(root.clientHeight * (1 - EYE_RATIO))}px`;
        return;
      }
      root.style.paddingTop = '';
      root.style.paddingBottom = readingMode === 'beat'
        ? '10px'
        : `${Math.max(10, root.clientHeight - lineHeight)}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(root);
    return () => observer.disconnect();
  }, [chapters, config.fontSize, readingMode]);

  const moveScroll = (root: HTMLElement, top: number) => {
    programmaticScroll.current = true;
    root.scrollTop = top;
    queueMicrotask(() => {
      programmaticScroll.current = false;
    });
  };

  const setReading = (index: number) => {
    readingRef.current = index;
    const root = rootRef.current;
    if (root) markReading(root, index);
  };

  const revealReading = (index: number) => {
    setReading(index);
    const root = rootRef.current;
    const line = root?.querySelectorAll<HTMLElement>('.line')[index];
    if (!root || !line) return;
    const rootRect = root.getBoundingClientRect();
    const lineRect = line.getBoundingClientRect();
    if (lineRect.top < rootRect.top + 4 || lineRect.bottom > rootRect.bottom - 4) {
      root.scrollTop += lineRect.top - rootRect.top;
    }
  };

  const applyBeat = useCallback((root: HTMLElement, index: number) => {
    const lines = [...root.querySelectorAll<HTMLElement>('.line')];
    const span = chapterSpan(chapters.map((chapter) => chapter.index), index, lines.length);
    lines.forEach((line, lineIndex) => {
      line.classList.toggle('beat-hidden', lineIndex < span.start || lineIndex >= span.end);
    });
  }, [chapters]);

  const jumpTo = (index: number, query = '') => {
    const root = rootRef.current;
    const line = root?.querySelectorAll<HTMLElement>('.line')[index];
    if (!root || !line) return;
    if (readingMode === 'beat') applyBeat(root, index);
    const eye = root.clientHeight * EYE_RATIO;
    moveScroll(root, readingMode === 'glide' ? Math.max(0, line.offsetTop - eye) : line.offsetTop);
    const owning = chapters.reduce<number | null>(
      (found, chapter) => (chapter.index <= index ? chapter.index : found),
      null,
    );
    const nextChapter = owning ?? index;
    if (glideHeld && nextChapter !== activeChapter) onGlideHold(false);
    keepChapter(nextChapter);
    setReading(index);
    const rootNow = rootRef.current;
    if (!rootNow || !query.trim()) return;
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    clearSearchFlash(rootNow);
    flashMatches(line, query);
    flashTimer.current = window.setTimeout(() => {
      const latest = rootRef.current;
      if (latest) clearSearchFlash(latest);
      flashTimer.current = null;
    }, 1600);
  };

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const lines = [...root.querySelectorAll<HTMLElement>('.line')];
    if (readingMode !== 'beat') {
      lines.forEach((line) => line.classList.remove('beat-hidden'));
      return;
    }
    const index = activeChapter ?? chapters[0]?.index ?? 0;
    applyBeat(root, index);
  }, [readingMode, activeChapter, chapters, text, applyBeat]);

  useEffect(() => {
    if (readingMode !== 'glide' || !glideOn || glideHeld) return;
    const root = rootRef.current;
    if (!root) return;
    const headings = chapters.map((chapter) => chapter.index);
    const lineCount = root.querySelectorAll('.line').length;
    const span = chapterSpan(headings, activeChapterRef.current ?? readingRef.current, lineCount);
    const eye = root.clientHeight * EYE_RATIO;
    const lines = [...root.querySelectorAll<HTMLElement>('.line')];
    const commentLine = (line: HTMLElement) => isCommentLine(line.dataset.kind ?? 'body', line.textContent ?? '');
    const firstSpoken = lines.findIndex((line, index) => index >= span.start && index < span.end && !commentLine(line));
    const anchorIndex = readingRef.current ?? span.start;
    const anchor = lines[anchorIndex];
    const startIndex = anchor && !commentLine(anchor) ? anchorIndex : firstSpoken;
    const startLine = startIndex >= 0 ? lines[startIndex] : undefined;
    if (startLine) moveScroll(root, Math.max(0, startLine.offsetTop - eye));
    let last = performance.now();
    let frame = 0;
    let stopped = false;
    const tick = (now: number) => {
      if (stopped) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const currentLines = [...root.querySelectorAll<HTMLElement>('.line')];
      if (currentLines.length === 0) return;
      const currentSpan = chapterSpan(headings, activeChapterRef.current ?? readingRef.current, currentLines.length);
      const slice = currentLines.slice(currentSpan.start, currentSpan.end);
      const spoken = slice.filter((line) => !commentLine(line));
      const lastSpoken = spoken[spoken.length - 1];
      if (!lastSpoken) {
        onGlideHold(true);
        return;
      }
      const distance = spokenHeight(slice.map((line) => ({
        height: line.offsetHeight,
        comment: commentLine(line),
      })));
      const heading = chapters.find((chapter) => chapter.index === currentSpan.start)?.text ?? '';
      const paceKey = heading ? chapterBudgetKey(tabId, heading) : '';
      const seconds = glideSeconds(config.chapterPaces[paceKey], config.chapterBudgets[paceKey]);
      moveScroll(root, root.scrollTop + glidePixelsPerSecond(distance, seconds) * dt);
      const eyeNow = root.clientHeight * EYE_RATIO;
      let under = currentSpan.start;
      let best = Number.POSITIVE_INFINITY;
      for (let index = currentSpan.start; index < currentSpan.end; index += 1) {
        const line = currentLines[index];
        if (!line) continue;
        const delta = Math.abs(line.offsetTop - (root.scrollTop + eyeNow));
        if (delta < best) {
          best = delta;
          under = index;
        }
      }
      let nearest = under;
      const landed = currentLines[under];
      if (landed && commentLine(landed)) {
        const jumped = currentLines.findIndex((line, index) => index >= under && index < currentSpan.end && !commentLine(line));
        if (jumped < 0) {
          onGlideHold(true);
          return;
        }
        moveScroll(root, Math.max(0, currentLines[jumped].offsetTop - eyeNow));
        nearest = jumped;
      }
      setReading(nearest);
      const owning = chapters.reduce<number | null>(
        (found, chapter) => (chapter.index <= nearest ? chapter.index : found),
        null,
      );
      if (owning !== null && owning !== activeChapterRef.current) keepChapter(owning);
      if (root.scrollTop + eyeNow >= lastSpoken.offsetTop + lastSpoken.offsetHeight * 0.35) {
        onGlideHold(true);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
    };
  }, [readingMode, glideOn, glideHeld, chapters, config.chapterBudgets, config.chapterPaces, tabId, onGlideHold]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav || activeChapter === null) return;
    const row = nav.querySelector<HTMLElement>('.chapter-link.active')?.closest('.chapter-row');
    if (!(row instanceof HTMLElement)) return;
    const navRect = nav.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    if (rowRect.top < navRect.top) nav.scrollTop -= navRect.top - rowRect.top;
    else if (rowRect.bottom > navRect.bottom) nav.scrollTop += rowRect.bottom - navRect.bottom;
  }, [activeChapter, chapters]);

  const moveChapter = (direction: 1 | -1) => {
    if (chapters.length === 0) return;
    const position = chapters.findIndex((chapter) => chapter.index === activeChapter);
    const next = chapters[Math.min(chapters.length - 1, Math.max(0, (position === -1 ? 0 : position) + direction))];
    if (next) jumpTo(next.index);
  };

  const moveReading = (direction: 1 | -1) => {
    const root = rootRef.current;
    if (!root) return;
    const count = root.querySelectorAll('.line').length;
    if (count === 0) return;
    const anchor = readingRef.current ?? activeChapter ?? 0;
    let start = 0;
    let end = count;
    for (const chapter of chapters) {
      if (chapter.index <= anchor) start = chapter.index;
      else {
        end = chapter.index;
        break;
      }
    }
    const current = readingRef.current;
    const target = current === null
      ? start
      : Math.min(end - 1, Math.max(start, current + direction));
    revealReading(target);
  };

  useEffect(() => {
    onActiveChapterChange(activeChapter);
  }, [activeChapter, onActiveChapterChange]);

  useEffect(() => {
    const handle: TextEditorHandle = {
      toggleKind: (kind) => {
        const root = rootRef.current;
        if (!root || !toggleLineKind(root, kind, config)) return;
        publish();
      },
      moveChapter,
      moveReading,
      revealLine: (index, query) => jumpTo(index, query),
      readingIndex: () => readingRef.current,
      ensureReading: () => {
        if (readingRef.current !== null) return;
        setReading(activeChapter ?? 0);
      },
      atLastChapter: () => {
        if (chapters.length === 0) return true;
        const position = chapters.findIndex((chapter) => chapter.index === activeChapter);
        return position >= 0 && position >= chapters.length - 1;
      },
    };
    editorRef.current = handle;
    return () => {
      if (editorRef.current === handle) editorRef.current = null;
    };
  });

  useLayoutEffect(() => {
    if (!queuedReveal) return;
    jumpTo(queuedReveal.line, queuedReveal.query);
    onRevealConsumed();
  }, [queuedReveal, onRevealConsumed, jumpTo]);

  return (
    <div className="text-editor">
      <nav
        ref={navRef}
        className={`chapter-nav${showChapters ? '' : ' is-hidden'}`}
        style={{ width: navWidth }}
        aria-label={t('chapters')}
        tabIndex={-1}
        onPointerDown={() => {
          navRef.current?.focus();
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          event.stopPropagation();
          moveChapter(event.key === 'ArrowDown' ? 1 : -1);
        }}
      >
        {chapters.length === 0 ? (
          <p className="chapter-empty">{t('chapterEmpty')}</p>
        ) : (
          chapters.map((chapter) => {
            const listKey = chapterBudgetKey(tabId, chapter.text);
            const listColor = config.chapterListColors[listKey];
            return (
            <div key={chapter.index} className="chapter-row">
              <button
                type="button"
                className={`chapter-link${chapter.index === activeChapter ? ' active' : ''}`}
                style={{ color: listColor ?? (chapter.index === activeChapter ? config.headingColor : config.fontColor) }}
                title={chapter.text}
                onClick={() => jumpTo(chapter.index)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setColorMenu({ heading: chapter.text, x: event.clientX, y: event.clientY });
                }}
              >
                {inkRuns(chapter.source).map((run, runIndex) => (
                  run.color
                    ? <span key={runIndex} style={{ color: run.color }}>{run.text}</span>
                    : <span key={runIndex}>{run.text}</span>
                ))}
              </button>
              <ChapterBudgetField
                seconds={config.chapterBudgets[chapterBudgetKey(tabId, chapter.text)]}
                onCommit={(seconds) => onChapterBudget(chapter.text, seconds)}
              />
            </div>
            );
          })
        )}
        {colorMenu ? (
          <div
            className="chapter-color-pop"
            style={{
              left: Math.min(colorMenu.x, window.innerWidth - 160),
              top: Math.min(colorMenu.y, window.innerHeight - 130),
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span className="chapter-color-label">{t('chapterListColor')}</span>
            <div className="chapter-color-swatches">
              {CHAPTER_LIST_COLORS.map((color) => {
                const selected = config.chapterListColors[chapterBudgetKey(tabId, colorMenu.heading)] === color;
                return (
                  <button
                    key={color}
                    type="button"
                    className={`chapter-color-swatch${selected ? ' selected' : ''}`}
                    style={{ backgroundColor: color }}
                    aria-label={color}
                    onClick={() => {
                      onChapterListColor(colorMenu.heading, selected ? null : color);
                      setColorMenu(null);
                    }}
                  />
                );
              })}
            </div>
            <button
              type="button"
              className="chapter-color-reset"
              onClick={() => {
                onChapterListColor(colorMenu.heading, null);
                setColorMenu(null);
              }}
            >
              {t('chapterListColorReset')}
            </button>
          </div>
        ) : null}
        <div
          className="chapter-resize"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const startX = event.screenX;
            const startWidth = navWidth;
            let latest = startWidth;
            const move = (moveEvent: PointerEvent) => {
              latest = Math.min(360, Math.max(120, startWidth + moveEvent.screenX - startX));
              onNavWidthChange(latest);
            };
            const stop = () => {
              onNavWidthCommit(latest);
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', stop);
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', stop);
          }}
        />
      </nav>
      <div className={`text-stage mode-${readingMode}`}>
      <div
        ref={rootRef}
        className={`text-area notes mode-${readingMode}${blind ? ' is-blind' : ''}${blind && peek ? ' is-peek' : ''}`}
        onWheel={() => {
          if (readingMode === 'glide' && glideOn && !glideHeld) onGlidePause();
        }}
        style={{
          fontFamily: config.fontFamily,
          fontSize: `${config.fontSize}px`,
          backgroundColor: config.bgColor,
        }}
        onPointerDown={() => {
          if (document.activeElement instanceof HTMLElement && navRef.current?.contains(document.activeElement)) {
            document.activeElement.blur();
          }
        }}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        data-placeholder={isEmpty ? t('placeholder') : ''}
        onInput={publish}
        onBlur={publish}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onContextMenu={(event) => {
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
          const range = selection.getRangeAt(0);
          const edge = (node: Node) => (node instanceof Element ? node : node.parentElement)?.closest('.line');
          if (edge(range.startContainer) !== edge(range.endContainer)) return;
          if (!event.currentTarget.contains(range.commonAncestorContainer)) return;
          event.preventDefault();
          wordRange.current = range.cloneRange();
          setWordMenu({ x: event.clientX, y: event.clientY });
        }}
      />
      {readingMode === 'glide' ? <div className="eye-line" style={{ top: `${EYE_RATIO * 100}%` }} /> : null}
      {wordMenu ? (
        <WordInkMenu
          x={wordMenu.x}
          y={wordMenu.y}
          onClose={() => setWordMenu(null)}
          onPick={(color) => {
            const root = rootRef.current;
            const saved = wordRange.current;
            const selection = window.getSelection();
            if (root && saved && selection) {
              selection.removeAllRanges();
              selection.addRange(saved);
              if (applyWordInk(root, color, config.noteColor)) publish();
            }
            setWordMenu(null);
          }}
        />
      ) : null}
      </div>
    </div>
  );
}

export default TextEditor;
