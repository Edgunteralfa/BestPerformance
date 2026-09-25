// MIT License - Copyright (c) 2026 BestPerformance Contributors

import { useMemo } from 'react';
import { formatMessage, useI18n } from '../i18n';
import { formatClock } from '../hooks/usePitchTimer';
import { parseText } from '../lineMarkup';
import { chapterBudgetKey } from '../types';
import '../styles/RehearsalPanel.css';

interface RehearsalPanelProps {
  text: string;
  tabId: string;
  byChapter: Record<string, number>;
  chapterBudgets: Record<string, number>;
  pitchSeconds: number;
  totalMs: number;
  onClose: () => void;
}

type ReviewStatus = 'open' | 'ok' | 'over';

interface ReviewRow {
  name: string;
  status: ReviewStatus;
  detail: string;
}

function reviewStatus(spentMs: number, budgetMs: number): ReviewStatus {
  if (budgetMs <= 0) return 'open';
  if (spentMs > budgetMs) return 'over';
  return 'ok';
}

function RehearsalPanel({
  text,
  tabId,
  byChapter,
  chapterBudgets,
  pitchSeconds,
  totalMs,
  onClose,
}: RehearsalPanelProps) {
  const { t } = useI18n();

  const detailFor = (spentMs: number, budgetMs: number) => {
    const status = reviewStatus(spentMs, budgetMs);
    const spent = formatClock(spentMs);
    switch (status) {
      case 'open':
        return formatMessage(t('reviewOpen'), { spent });
      case 'ok':
        return formatMessage(t('reviewOk'), { spent, plan: formatClock(budgetMs) });
      case 'over':
        return formatMessage(t('reviewOver'), {
          spent,
          over: formatClock(spentMs - budgetMs),
        });
      default: {
        const unreachable: never = status;
        return unreachable;
      }
    }
  };

  const rows = useMemo(() => {
    const next: ReviewRow[] = [];
    parseText(text).forEach((line, index) => {
      if (line.kind !== 'heading') return;
      const name = line.text.trim();
      if (!name) return;
      const spentMs = byChapter[`${tabId}:${index}`] ?? 0;
      const budgetMs = (chapterBudgets[chapterBudgetKey(tabId, name)] ?? 0) * 1000;
      if (spentMs <= 0 && budgetMs <= 0) return;
      const status = reviewStatus(spentMs, budgetMs);
      const spent = formatClock(spentMs);
      let detail = formatMessage(t('reviewOpen'), { spent });
      if (status === 'ok') detail = formatMessage(t('reviewOk'), { spent, plan: formatClock(budgetMs) });
      if (status === 'over') {
        detail = formatMessage(t('reviewOver'), { spent, over: formatClock(spentMs - budgetMs) });
      }
      next.push({ name, status, detail });
    });
    return next;
  }, [text, tabId, byChapter, chapterBudgets, t]);

  const pitchBudgetMs = pitchSeconds * 1000;
  const pitchStatus = reviewStatus(totalMs, pitchBudgetMs);

  return (
    <div className="rehearsal">
      <div className="rehearsal-head">
        <span className="rehearsal-title">{t('reviewTitle')}</span>
        <button type="button" className="timer-button" onClick={onClose}>{t('close')}</button>
      </div>
      {rows.length === 0 ? (
        <p className="rehearsal-empty">{t('reviewEmpty')}</p>
      ) : (
        <ul className="rehearsal-list">
          {rows.map((row, index) => (
            <li key={`${row.name}:${index}`} className={`rehearsal-row ${row.status}`}>
              <span className="rehearsal-name" title={row.name}>{row.name}</span>
              <span className="rehearsal-time">{row.detail}</span>
            </li>
          ))}
        </ul>
      )}
      <div className={`rehearsal-total ${pitchStatus}`}>
        <span>{t('reviewPitch')}</span>
        <span>{detailFor(totalMs, pitchBudgetMs)}</span>
      </div>
    </div>
  );
}

export default RehearsalPanel;
