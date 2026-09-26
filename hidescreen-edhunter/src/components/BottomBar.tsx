// MIT License - Copyright (c) 2026 BestPerformance Contributors

import type { Config } from '../types';
import '../styles/BottomBar.css';
import { useI18n } from '../i18n';

interface BottomBarProps {
  config: Config;
  setConfig: (updates: Partial<Config>) => Promise<void>;
  isLocked: boolean;
  onToggleLock: () => void;
  onToggleHeading: () => void;
  onToggleMark: () => void;
  onToggleNote: () => void;
  onClearText: () => void;
  blind: boolean;
  onToggleBlind: () => void;
  showFontSize: boolean;
  showHeading: boolean;
  showMarks: boolean;
  showClear: boolean;
  showBlind: boolean;
  showLock: boolean;
}

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const UnlockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3l18 18" />
    <path d="M10.6 6.2A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a18.4 18.4 0 0 1-4.1 4.6" />
    <path d="M6.1 6.1C3.5 7.8 2 12 2 12s3.5 7 10 7a10.8 10.8 0 0 0 4.2-.8" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);

function BottomBar({ config, setConfig, isLocked, onToggleLock, onToggleHeading, onToggleMark, onToggleNote, onClearText, blind, onToggleBlind, showFontSize, showHeading, showMarks, showClear, showBlind, showLock }: BottomBarProps) {
  const { t } = useI18n();
  const increaseFontSize = () => {
    const newSize = Math.min(48, config.fontSize + 1);
    setConfig({ fontSize: newSize });
  };

  const decreaseFontSize = () => {
    const newSize = Math.max(8, config.fontSize - 1);
    setConfig({ fontSize: newSize });
  };

  if (!showFontSize && !showHeading && !showMarks && !showClear && !showBlind && !showLock) return null;

  return (
    <div className="bottom-bar">
      {showFontSize ? <div className="font-size-controls">
        <button className="control-button font-btn" onClick={decreaseFontSize} title={t('decreaseFont')}>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <span className="font-label">Aa</span>
        <button className="control-button font-btn" onClick={increaseFontSize} title={t('increaseFont')}>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="5" y1="1" x2="5" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div> : null}

      {showHeading ? (
        <button className="control-button heading-button" onClick={onToggleHeading} title={t('toggleHeading')}>
          H
        </button>
      ) : null}
      {showMarks ? (
        <>
          <button className="control-button mark-button" onClick={onToggleMark} title={t('toggleMark')}>
            <span className="mark-swatch" style={{ backgroundColor: config.markColor }} />
          </button>
          <button className="control-button mark-button" onClick={onToggleNote} title={t('toggleNote')}>
            <span className="mark-swatch" style={{ backgroundColor: config.noteColor }} />
          </button>
        </>
      ) : null}

      {showClear ? (
        <button className="control-button clear-button" onClick={onClearText} title={t('clearText')}>
          {t('clear')}
        </button>
      ) : null}

      <div className="spacer" />

      {showBlind ? (
        <button
          className={`control-button blind-button${blind ? ' on' : ''}`}
          onClick={onToggleBlind}
          title={blind ? t('blindOff') : t('blindOn')}
        >
          {blind ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      ) : null}

      {showLock ? <button
        className={`control-button lock-button ${isLocked ? 'locked' : ''}`}
        onClick={onToggleLock}
        title={isLocked ? t('unlock') : t('lock')}
      >
        {isLocked ? <LockIcon /> : <UnlockIcon />}
      </button> : null}
    </div>
  );
}

export default BottomBar;
