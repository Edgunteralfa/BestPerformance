// MIT License - Copyright (c) 2026 BestPerformance Contributors

import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { getCurrentWindow, LogicalPosition, LogicalSize } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { I18nProvider, useI18n } from '../i18n';
import { useConfig } from '../hooks/useConfig';
import { fillEditor, paintLine, parseText, readLines, serialize, toggleLineKind, type LineKind } from '../lineMarkup';
import { isMac } from '../platform';
import { windowMaskTitle, type Config } from '../types';
import { OpacityControl } from './TitleBar';
import '../styles/App.css';
import '../styles/TitleBar.css';
import '../styles/CardWindow.css';

const cardWindow = getCurrentWindow();
const MIN_WIDTH = 180;
const MIN_HEIGHT = 120;

function CardApp() {
  const { config, setConfig, loading } = useConfig();
  if (loading) return null;
  return (
    <I18nProvider language={config.language}>
      <CardShell config={config} setConfig={setConfig} />
    </I18nProvider>
  );
}

function CardShell({
  config,
  setConfig,
}: {
  config: Config;
  setConfig: (updates: Partial<Config>) => Promise<void>;
}) {
  const { t } = useI18n();
  const [text, setText] = useState(config.cardText);
  const [active, setActive] = useState(false);
  const resizeDrag = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const placed = useRef(false);

  useEffect(() => {
    const title = windowMaskTitle(config.windowMask);
    void cardWindow.setTitle(title);
    if (isMac) document.title = title;
  }, [config.windowMask]);

  useEffect(() => {
    if (placed.current) return;
    placed.current = true;
    void cardWindow.setSize(new LogicalSize(config.cardWidth, config.cardHeight));
    void cardWindow.setPosition(new LogicalPosition(config.cardX, config.cardY));
  }, [config.cardHeight, config.cardWidth, config.cardX, config.cardY]);

  useEffect(() => {
    if (skipCardSave.current) {
      skipCardSave.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      void setConfig({ cardText: text });
    }, 300);
    return () => window.clearTimeout(id);
  }, [setConfig, text]);

  useEffect(() => {
    const unlisten = cardWindow.onFocusChanged(({ payload }) => {
      setActive(payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    let timer = 0;
    const unlisten = cardWindow.onMoved(({ payload }) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void cardWindow.scaleFactor().then((scale) => {
          void setConfig({
            cardX: Math.round(payload.x / scale),
            cardY: Math.round(payload.y / scale),
          });
        });
      }, 200);
    });
    return () => {
      window.clearTimeout(timer);
      unlisten.then((fn) => fn());
    };
  }, [setConfig]);

  const hide = async () => {
    await cardWindow.hide();
    await setConfig({ cardVisible: false });
  };

  const editorRef = useRef<HTMLDivElement>(null);
  const serializedRef = useRef(text);
  const skipCardSave = useRef(false);

  useEffect(() => {
    const unlisten = listen<{ cardText: string; cardFontSize: number }>('pitch-applied', (event) => {
      skipCardSave.current = true;
      setText(event.payload.cardText);
      void setConfig({
        cardText: event.payload.cardText,
        cardFontSize: event.payload.cardFontSize,
      });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setConfig]);

  useLayoutEffect(() => {
    const root = editorRef.current;
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
  }, [config, text]);

  const publish = () => {
    const root = editorRef.current;
    if (!root) return;
    const next = serialize(readLines(root));
    serializedRef.current = next;
    setText(next);
  };

  const markLine = (kind: Exclude<LineKind, 'body'>) => {
    const root = editorRef.current;
    if (!root || !toggleLineKind(root, kind, config)) return;
    publish();
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
    if (line && line.parentElement === editorRef.current) {
      line.after(block);
    } else {
      editorRef.current?.appendChild(block);
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

  return (
    <div
      className={active ? 'app is-active' : 'app'}
      style={{ backgroundColor: config.bgColor, opacity: config.cardOpacity }}
    >
      <div data-tauri-drag-region className="title-bar card-title-bar">
        <div data-tauri-drag-region className="title-left">
          <span data-tauri-drag-region className="title card-title">{t('cardTitle')}</span>
          <div className="card-font">
            <button
              type="button"
              className="card-font-button"
              title={t('decreaseFont')}
              onClick={() => void setConfig({ cardFontSize: Math.max(8, config.cardFontSize - 1) })}
            >
              −
            </button>
            <span className="card-font-size">{config.cardFontSize}</span>
            <button
              type="button"
              className="card-font-button"
              title={t('increaseFont')}
              onClick={() => void setConfig({ cardFontSize: Math.min(48, config.cardFontSize + 1) })}
            >
              +
            </button>
          </div>
          <div className="card-marks">
            <button
              type="button"
              className="card-mark heading"
              title={t('toggleHeading')}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => markLine('heading')}
            >
              H
            </button>
            <button
              type="button"
              className="card-mark"
              title={t('toggleMark')}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => markLine('mark')}
            >
              <span className="card-swatch" style={{ backgroundColor: config.markColor }} />
            </button>
            <button
              type="button"
              className="card-mark"
              title={t('toggleNote')}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => markLine('note')}
            >
              <span className="card-swatch" style={{ backgroundColor: config.noteColor }} />
            </button>
          </div>
        </div>
        <div className="title-bar-buttons">
          <OpacityControl
            value={config.cardOpacity}
            onChange={(value) => { void setConfig({ cardOpacity: value }); }}
          />
          <button type="button" className="title-bar-button close" onClick={hide} title={t('close')}>
            ✕
          </button>
        </div>
      </div>
      <div
        ref={editorRef}
        className="card-text"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        data-placeholder={text.length === 0 ? t('cardPlaceholder') : ''}
        style={{
          fontFamily: config.fontFamily,
          fontSize: `${config.cardFontSize}px`,
          backgroundColor: config.bgColor,
        }}
        onInput={publish}
        onBlur={publish}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
      />
      <div
        className="resize-grip"
        onPointerDown={async (event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          const size = await cardWindow.innerSize();
          const scale = await cardWindow.scaleFactor();
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
          void cardWindow.setSize(new LogicalSize(width, height));
        }}
        onPointerUp={async () => {
          resizeDrag.current = null;
          const size = await cardWindow.innerSize();
          const scale = await cardWindow.scaleFactor();
          await setConfig({
            cardWidth: Math.round(size.width / scale),
            cardHeight: Math.round(size.height / scale),
          });
        }}
      />
    </div>
  );
}

export default CardApp;
