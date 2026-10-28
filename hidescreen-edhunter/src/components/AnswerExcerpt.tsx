// MIT License - Copyright (c) 2026 BestPerformance Contributors
import { useState } from 'react';
import type { AnswerDetail, AnswerVariants } from '../types';

function clippedAnswer(text: string, detail: AnswerDetail): string {
  const trimmed = text.trim();
  if (detail === 'complete' || !trimmed) return trimmed;
  const maximum = detail === 'brief' ? 175 : 520;
  if (trimmed.length <= maximum) return trimmed;
  const end = trimmed.slice(0, maximum).lastIndexOf(' ');
  return trimmed.slice(0, Math.max(end, Math.floor(maximum * 0.72))).trimEnd() + '…';
}

function explicitEvidence(text: string): 'VERIFIED' | 'DECLARED' | 'OBSERVED' | null {
  // Only the author's explicit tags count. Never infer factual verification.
  return (/\[(VERIFIED|DECLARED|OBSERVED)\]/i.exec(text)?.[1].toUpperCase() as 'VERIFIED' | 'DECLARED' | 'OBSERVED' | undefined) ?? null;
}

/** Three modes control one source-backed answer. If users authored A_SHORT /
 * A_MEDIUM / A_DETAILED, show those verbatim. Otherwise show a non-generative
 * excerpt of the available full answer. No AI rewriting or cloud call.
 */
export function AnswerExcerpt({ answer, variants, defaultDetail }: {
  answer: string;
  variants?: AnswerVariants;
  defaultDetail: AnswerDetail;
}) {
  const [override, setOverride] = useState<AnswerDetail | null>(null);
  const [feedback, setFeedback] = useState('');
  const detail = override ?? defaultDetail;
  const authored = variants?.[detail];
  const fullSource = authored || answer;
  const visible = authored ? authored : clippedAnswer(answer, detail);
  const shortened = !authored && visible !== answer.trim();
  const evidence = explicitEvidence(fullSource);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullSource);
      setFeedback('Скопировано');
    } catch {
      setFeedback('Не удалось скопировать');
    }
  };
  if (!answer.trim() && !Object.values(variants ?? {}).some(Boolean)) {
    return <div className="pitch-answer-empty">Ответ не привязан к этому фрагменту. Открой исходную заметку.</div>;
  }
  return (
    <div className="pitch-answer-body">
      <div className="pitch-answer-heading">
        <span>Подготовленный ответ</span>
        {evidence && <span className={'pitch-answer-evidence pitch-answer-evidence--' + evidence.toLowerCase()}>{evidence}</span>}
        <button type="button" className="pitch-answer-copy" onClick={() => void copy()}
          title="Копировать выбранную подготовленную версию без сокращения" aria-label="Копировать выбранный ответ">
          Копировать
        </button>
      </div>
      <div className="pitch-answer-modes" role="group" aria-label="Длина ответа в этой карточке">
        {(['brief', 'normal', 'complete'] as const).map(mode => (
          <button type="button" key={mode} onClick={() => { setOverride(mode); setFeedback(''); }}
            className={detail === mode ? 'active' : ''} aria-pressed={detail === mode}>
            {mode === 'brief' ? 'Коротко' : mode === 'normal' ? 'Средне' : 'Полностью'}
          </button>
        ))}
      </div>
      <p className="pitch-answer-copytext">{visible}</p>
      {shortened && <span className="pitch-answer-note">Показан фрагмент исходного ответа. «Полностью» раскрывает весь текст.</span>}
      {authored && <span className="pitch-answer-note">Отдельно подготовленная версия: A_{detail === 'brief' ? 'SHORT' : detail === 'normal' ? 'MEDIUM' : 'DETAILED'}.</span>}
      {feedback && <span role="status" className="pitch-answer-note">{feedback}</span>}
    </div>
  );
}
