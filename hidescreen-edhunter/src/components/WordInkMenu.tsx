// MIT License - Copyright (c) 2026 BestPerformance Contributors

import { useEffect, useRef } from 'react';
import { TEXT_COLORS } from '../types';
import { useI18n } from '../i18n';
import '../styles/TextEditor.css';

function WordInkMenu({
  x,
  y,
  onPick,
  onClose,
}: {
  x: number;
  y: number;
  onPick: (color: string | null) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: Event) => {
      if (event.target instanceof Node && popRef.current?.contains(event.target)) return;
      onClose();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [onClose]);

  return (
    <div
      ref={popRef}
      className="chapter-color-pop"
      style={{
        left: Math.min(x, window.innerWidth - 160),
        top: Math.min(y, window.innerHeight - 150),
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="chapter-color-label">{t('wordInk')}</span>
      <div className="chapter-color-swatches">
        {TEXT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className="chapter-color-swatch"
            style={{ backgroundColor: color }}
            aria-label={color}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(color)}
          />
        ))}
      </div>
      <button
        type="button"
        className="chapter-color-reset"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onPick(null)}
      >
        {t('wordInkReset')}
      </button>
    </div>
  );
}

export default WordInkMenu;
