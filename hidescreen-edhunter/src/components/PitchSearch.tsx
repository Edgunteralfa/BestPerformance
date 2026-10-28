// MIT License - Copyright (c) 2026 BestPerformance Contributors

import { useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { visibleText, type NoteTab, type SemanticSettings, type AnswerVariants, type AnswerDetail } from '../types';
import { buildSemanticIndex, extractSemanticCandidates, searchSemanticIndex, semanticSourceSignature, type SemanticHit } from '../semanticSearch';
import { findContextHits } from '../contextSearch';
import { useI18n } from '../i18n';
import { getIndexProgress, setIndexStatus } from '../indexProgress';
import { AnswerExcerpt } from './AnswerExcerpt';
import { buildSingleQaEvidence, groupQaResults, qaHitKey, qaMainRejection } from '../qaPresentation';
import '../styles/PitchSearch.css';

interface PitchSearchProps {
  tabs: NoteTab[];
  excludedTabIds: string[];
  onExcludedChange: (excluded: string[]) => void;
  onJump: (tabId: string, line: number, query: string) => void;
  semantic: SemanticSettings;
  semanticExcludedTabIds: string[];
  contestContext: string;
}

interface Hit {
  tabId: string;
  tabName: string;
  line: number;
  text: string;
  answer?: string;
  variants?: AnswerVariants;
  kind?: 'question' | 'excerpt';
  score?: number;
  method?: 'hybrid' | 'semantic' | 'exact terms';
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

function PitchSearch({ tabs, excludedTabIds, onExcludedChange, onJump, semantic, semanticExcludedTabIds, contestContext }: PitchSearchProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [contextMode, setContextMode] = useState(false);
  const [draft, setDraft] = useState<{ question: string; signature: string; context: string; detail: AnswerDetail; sourceKey: string; text: string } | null>(null);
  const [draftPending, setDraftPending] = useState(false);
  const [draftLength, setDraftLength] = useState<AnswerDetail>(semantic.defaultAnswerDetail);
  const [draftError, setDraftError] = useState('');
  const [sourceSelection, setSourceSelection] = useState<{ question: string; signature: string; key: string } | null>(null);
  const draftRequest = useRef(0);
  const [answerDetailOverride, setAnswerDetailOverride] = useState<{ question: string; detail: AnswerDetail } | null>(null);
  const answerDetail = answerDetailOverride?.question === query ? answerDetailOverride.detail : semantic.defaultAnswerDetail;
  const [open, setOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const [seenQuery, setSeenQuery] = useState(query);
  if (query !== seenQuery) {
    setSeenQuery(query);
    setSelected(0);
  }
  const boxRef = useRef<HTMLDivElement>(null);
  const searchable = useMemo(
    () => tabs.filter((tab) => !excludedTabIds.includes(tab.id)),
    [tabs, excludedTabIds],
  );
  const lexicalHits = useMemo(() => contextMode
    ? findContextHits(searchable, query).map(hit => ({ tabId: hit.tabId, tabName: hit.tabName, line: hit.line, text: hit.question, answer: hit.answer, kind: hit.kind }))
    : hitsFor(searchable, query), [searchable, query, contextMode]);
  // Scope is intentionally independent of the ordinary search checkboxes.
  const indexedTabs = useMemo(() =>
    tabs.filter(tab => !semanticExcludedTabIds.includes(tab.id)), [tabs, semanticExcludedTabIds]);

  // Ollama tags can be replaced with new weights under the same name. Resolve
  // the model digest on startup and periodically; old vectors must never be
  // reused after a weight change.
  const [identity, setIdentity] = useState<{
    endpoint: string; model: string; digest: string;
  } | null>(null);
  const [identityError, setIdentityError] = useState('');
  useEffect(() => {
    if (!semantic.enabled || !semantic.model.trim()) return;
    setIndexStatus('checking', 'Проверка установленной модели Ollama…', indexedTabs.length);
    let cancelled = false;
    const check = async () => {
      try {
        const digest = await invoke<string>('local_ollama_model_identity', {
          endpoint: semantic.endpoint, model: semantic.model,
        });
        if (!cancelled) {
          setIdentity({ endpoint: semantic.endpoint, model: semantic.model, digest });
          setIdentityError('');
        }
      } catch (error) {
        if (!cancelled) {
          setIdentity(null); setIdentityError(String(error));
          setIndexStatus('error', `Не удалось проверить модель Ollama: ${String(error)}`, indexedTabs.length);
        }
      }
    };
    void check();
    const timer = window.setInterval(() => { void check(); }, 90_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [semantic.enabled, semantic.endpoint, semantic.model, indexedTabs.length]);

  const modelDigest = identity?.endpoint === semantic.endpoint && identity.model === semantic.model
    ? identity.digest : null;
  const signature = useMemo(() => semanticSourceSignature(
    indexedTabs, semantic.endpoint, semantic.model, semantic.revision,
    semantic.includeExcerpts, modelDigest ?? 'not-loaded',
  ), [indexedTabs, semantic.endpoint, semantic.model, semantic.revision, semantic.includeExcerpts, modelDigest]);

  // Do not call Ollama on every keystroke. Text edits, pitch switches and
  // checkbox changes settle before any indexing work begins.
  const [settledSignature, setSettledSignature] = useState(signature);
  useEffect(() => {
    if (semantic.enabled && semantic.model.trim() && indexedTabs.length > 0 && modelDigest !== null) {
      setIndexStatus('waiting', 'Ожидание окончания редактирования текста…', indexedTabs.length);
    }
    const timer = window.setTimeout(() => setSettledSignature(signature), 900);
    return () => window.clearTimeout(timer);
  }, [signature, semantic.enabled, semantic.model, indexedTabs.length, modelDigest]);
  const candidates = useMemo(() =>
    settledSignature === signature
      ? extractSemanticCandidates(indexedTabs, semantic.includeExcerpts)
      : [],
    [settledSignature, signature, indexedTabs, semantic.includeExcerpts]);
  const [indexSnapshot, setIndexSnapshot] = useState<{
    signature: string;
    entries: Awaited<ReturnType<typeof buildSemanticIndex>>;
  } | null>(null);
  const [semanticResult, setSemanticResult] = useState<{
    signature: string; question: string; hits: SemanticHit[];
  } | null>(null);
  const [indexState, setIndexState] = useState('');
  const [semanticError, setSemanticError] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!semantic.enabled || !semantic.model.trim()) {
      setIndexStatus(semantic.enabled ? 'no-model' : 'disabled',
        semantic.enabled ? 'Выберите embedding-модель Ollama.' : 'Семантический поиск отключён.');
      queueMicrotask(() => {
        if (!cancelled) { setIndexSnapshot(null); setIndexState(''); setSemanticError(''); }
      });
      return () => { cancelled = true; };
    }
    if (settledSignature !== signature || modelDigest === null) return () => { cancelled = true; };
    if (indexedTabs.length === 0) {
      setIndexStatus('empty', 'Нет выбранных источников для индексации.', 0);
      queueMicrotask(() => {
        if (!cancelled) { setIndexSnapshot({ signature, entries: [] }); setIndexState('No sources selected'); }
      });
      return () => { cancelled = true; };
    }
    setIndexStatus('indexing', 'Проверка кеша и подготовка фрагментов…', indexedTabs.length,
      0, candidates.length);
    queueMicrotask(() => {
      if (!cancelled) {
        setIndexState('Syncing changes…');
        setSemanticError('');
      }
    });
    void buildSemanticIndex(
      candidates, semantic.endpoint, semantic.model,
      (done, total, cached, generated, phase) => {
        if (!cancelled) {
          setIndexState(`Indexed ${done} / ${total} chunks · ${indexedTabs.length} tabs`);
          setIndexStatus('indexing', phase === 'embedding'
            ? 'Ollama вычисляет embeddings для новых или изменённых фрагментов…'
            : 'Проверка кеша и обновление поискового индекса…',
          indexedTabs.length, done, total, cached, generated);
        }
      },
      () => cancelled, semantic.revision, modelDigest,
    ).then(entries => {
      if (!cancelled) {
        setIndexSnapshot({ signature, entries });
        setIndexState(`Ready: ${entries.length} chunks in ${indexedTabs.length} tabs`);
        const previous = getIndexProgress();
        setIndexStatus('ready', 'Индекс готов: поиск по смыслу доступен.', indexedTabs.length,
          entries.length, entries.length, previous.cached, previous.generated);
      }
    }).catch(error => {
      if (!cancelled) {
        setSemanticError(String(error));
        setIndexState('Ollama unavailable; keyword fallback');
        setIndexStatus('error', `Ошибка индексации: ${String(error)}`, indexedTabs.length);
      }
    });
    return () => { cancelled = true; };
  }, [
    candidates, indexedTabs.length, semantic.enabled, semantic.endpoint,
    semantic.model, semantic.revision, settledSignature, signature, modelDigest,
  ]);

  // An old index is never used with changed notes, a different pitch,
  // or a different source selection, even while a rebuild is underway.
  const currentIndex = semantic.enabled && indexSnapshot?.signature === signature
    ? indexSnapshot.entries : null;
  useEffect(() => {
    let cancelled = false;
    if (!contextMode || !semantic.enabled || currentIndex === null || !query.trim()) {
      queueMicrotask(() => { if (!cancelled) setSearching(false); });
      return () => { cancelled = true; };
    }
    queueMicrotask(() => { if (!cancelled) setSearching(true); });
    void searchSemanticIndex(currentIndex, query, semantic.endpoint, semantic.model, semantic.minimum)
      .then(hits => {
        if (!cancelled) {
          setSemanticResult({ signature, question: query, hits });
          setSemanticError('');
        }
      }).catch(error => {
        if (!cancelled) setSemanticError(String(error));
      }).finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [
    contextMode, semantic.enabled, semantic.endpoint, semantic.model,
    semantic.minimum, currentIndex, query, signature,
  ]);

  const usingSemantic = contextMode && semantic.enabled && currentIndex !== null && !semanticError && !identityError;
  const latestResult = semanticResult?.signature === signature && semanticResult.question === query
    ? semanticResult.hits : [];
  const hits: Hit[] = usingSemantic
    ? latestResult.map(hit => ({
        tabId: hit.tabId, tabName: hit.tabName, line: hit.line,
        text: hit.text, answer: hit.answer, variants: hit.variants, kind: hit.kind, score: hit.score,
        method: hit.method,
      }))
    : lexicalHits;

  const qaGroups = groupQaResults(hits, usingSemantic, semantic.minimum, semantic.mainAnswerMinimum);
  const selectedSource = sourceSelection?.question === query && sourceSelection.signature === signature
    ? hits.find(hit => qaHitKey(hit) === sourceSelection.key && hit.kind === 'question' && hit.answer?.trim()) ?? qaGroups.primary
    : qaGroups.primary;
  const selectedSourceKey = selectedSource ? qaHitKey(selectedSource) : '';

  const generateDraft = async () => {
    if (!semantic.generateAnswers || !semantic.answerModel.trim() || draftPending) return;
    const evidence = buildSingleQaEvidence(selectedSource);
    if (!evidence) { setDraftError('Выбери подготовленный Q&A-ответ. Генерация без источника запрещена.'); return; }
    const sourceKey = selectedSourceKey;
    const request = ++draftRequest.current;
    const question = query;
    const snapshot = signature;
    const context = contestContext;
    setDraft(null);
    setDraftPending(true);
    setDraftError('');
    try {
      const text = await invoke<string>('local_ollama_answer', {
        endpoint: semantic.endpoint, model: semantic.answerModel,
        question, context: context.slice(0, 5500), evidence, detail: draftLength,
      });
      if (request === draftRequest.current) setDraft({ question, signature: snapshot, context, detail: draftLength, sourceKey, text });
    } catch (error) {
      if (request === draftRequest.current) setDraftError(String(error));
    } finally { if (request === draftRequest.current) setDraftPending(false); }
  };

  useEffect(() => {
    const unlisten = listen<string>('lingua-query', (event) => {
      const word = event.payload.trim();
      if (!word) return;
      setContextMode(false);
      setQuery(word);
      setOpen(true);
    });
    return () => {
      void unlisten.then((stop) => stop());
    };
  }, []);

  useEffect(() => {
    const unlisten = listen<string>('b25-context-query', event => {
      const question = event.payload.trim();
      if (!question) return;
      setContextMode(true);
      setQuery(question);
      setOpen(true);
    });
    return () => { void unlisten.then(stop => stop()); };
  }, []);

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
    onJump(hit.tabId, hit.line, contextMode ? '' : query);
    setOpen(false);
  };

  const toggleTab = (tabId: string) => {
    const excluded = new Set(excludedTabIds);
    if (excluded.has(tabId)) excluded.delete(tabId);
    else excluded.add(tabId);
    onExcludedChange([...excluded].filter((id) => tabs.some((tab) => tab.id === id)));
  };

  const displayHits = contextMode
    ? [...(qaGroups.primary ? [qaGroups.primary] : []), ...qaGroups.alternatives]
    : hits;

  const renderHit = (hit: Hit, index: number) => {
    const key = qaHitKey(hit);
    const rejectedReason = contextMode ? qaMainRejection(hit, usingSemantic, qaGroups.matchFloor) : null;
    return (
      <li key={key} className={contextMode
        ? `pitch-answer-card${qaGroups.primary && key === qaHitKey(qaGroups.primary) ? ' pitch-answer-card--top' : ''}`
        : ''}>
        <button type="button" className={`pitch-search-hit${index === selected ? ' selected' : ''}`}
          onMouseEnter={() => setSelected(index)}
          onMouseDown={event => event.preventDefault()}
          onClick={() => jump(hit)}>
          <span className="pitch-search-tab">{hit.tabName}</span>
          <span className="pitch-search-line">{contextMode ? hit.text : <Snippet text={hit.text} query={query}/>}</span>
          {contextMode && hit.method && <span className="pitch-search-excerpt">
            {hit.method === 'hybrid' ? 'Semantic + BM25' : hit.method === 'semantic' ? 'Semantic match' : 'Exact terms'}
            {hit.method !== 'exact terms' && typeof hit.score === 'number' ? ` · similarity ${hit.score.toFixed(2)}` : ''}
            {' · сходство, не достоверность фактов'}
          </span>}
          {contextMode && rejectedReason && <span className="pitch-search-excerpt">Почему не основной: {rejectedReason}</span>}
          {contextMode && hit.kind === 'excerpt' && <span className="pitch-search-excerpt">
            Фрагмент заметки, не подтверждённая пара вопрос–ответ
          </span>}
        </button>
        {contextMode && hit.kind === 'question' && !!hit.answer?.trim() &&
          <button type="button" className="pitch-answer-source-select"
            aria-pressed={selectedSourceKey === key}
            onClick={() => { setSourceSelection({ question: query, signature, key }); setDraftError(''); }}>
            {selectedSourceKey === key ? '✓ Выбран для AI Draft' : 'Использовать для AI Draft'}
          </button>}
        {contextMode && <AnswerExcerpt answer={hit.answer ?? ''} variants={hit.variants} defaultDetail={answerDetail}/>}
      </li>
    );
  };

  return (
    <div className="pitch-search" ref={boxRef}>
      <div className="pitch-search-field">
      <input
        className="pitch-search-input"
        value={query}
        placeholder={contextMode ? 'B25: поиск ответов по вопросу' : t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        onChange={(event) => {
          setContextMode(false);
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setSelected((index) => Math.min(displayHits.length - 1, index + 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelected((index) => Math.max(0, index - 1));
          } else if (contextMode && /^[123]$/.test(event.key) && displayHits.length >= Number(event.key)) {
            event.preventDefault();
            jump(displayHits[Number(event.key) - 1]);
          } else if (event.key === 'Enter') {
            event.preventDefault();
            jump(displayHits[selected]);
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
        <ul className={`pitch-search-results${contextMode ? ' pitch-search-results--context' : ''}`}>
          {contextMode && <li className="pitch-search-context-label">{usingSemantic ? 'Гибридный поиск · BM25 + Ollama embeddings · локально' : 'Keyword fallback · local'}{semantic.enabled && <span> · {searching ? 'Поиск…' : modelDigest === null ? 'Проверка модели…' : settledSignature !== signature ? 'Обновление индекса…' : indexState}</span>}{(semanticError || identityError) && <span> · {semanticError || identityError}</span>}</li>}
          {contextMode && <li className="pitch-answer-toolbar" aria-label="Режим просмотра исходного ответа">
            <span>Длина подготовленного ответа:</span>
            {(['brief', 'normal', 'complete'] as const).map(mode => (
              <button type="button" key={mode} className={answerDetail === mode ? 'active' : ''}
                aria-pressed={answerDetail === mode} onClick={() => setAnswerDetailOverride({ question: query, detail: mode })}>
                {mode === 'brief' ? 'Кратко' : mode === 'normal' ? 'Обычно' : 'Полностью'}
              </button>
            ))}
            <span className="pitch-answer-keyboard">1–3 — открыть источник</span>
          </li>}
          {contextMode && qaGroups.primary && (
            <>
              <li className="pitch-qa-main-label">Основной подготовленный ответ · сильное семантическое совпадение</li>
              {renderHit(qaGroups.primary, 0)}
            </>
          )}
          {contextMode && !qaGroups.primary && (
            <li className="pitch-qa-no-main" role="status">
              {searching ? 'Идёт поиск подходящего Q&A…'
                : usingSemantic
                  ? `Нет достаточно сильного семантического совпадения (порог для основного ответа: ${qaGroups.matchFloor.toFixed(2)}). Возможные источники доступны ниже, но их требуется проверить вручную.`
                  : 'Семантический поиск сейчас недоступен. Варианты текстового поиска доступны ниже, но основной ответ автоматически не назначается.'}
            </li>
          )}
          {contextMode && semantic.generateAnswers && <li className="pitch-ai-draft">
            <div className="pitch-ai-draft__head">
              <strong>AI Draft · локальная Ollama</strong>
              <button type="button" disabled={draftPending || !semantic.answerModel.trim() || !selectedSource}
                onClick={() => void generateDraft()}>{draftPending ? 'Подготовка…' : 'Сформировать черновик'}</button>
            </div>
            <div className="pitch-answer-modes" role="group" aria-label="Объём генерируемого AI-ответа">
              {(['brief', 'normal', 'complete'] as const).map(mode => (
                <button key={mode} type="button" disabled={draftPending} className={draftLength === mode ? 'active' : ''}
                  aria-pressed={draftLength === mode} onClick={() => setDraftLength(mode)}>
                  {mode === 'brief' ? 'Кратко · 50–80 слов' : mode === 'normal' ? 'Обычно · 100–150 слов' : 'Подробно · 180–250 слов'}
                </button>
              ))}
            </div>
            {!semantic.answerModel.trim() && <p>Выбери отдельную модель для ответов в настройках.</p>}
            {draftError && <p role="alert">{draftError}</p>}
            {draft?.question === query && draft.signature === signature && draft.context === contestContext && draft.detail === draftLength && draft.sourceKey === selectedSourceKey && (
              <div>
                <p className="pitch-ai-draft__warning">Черновик AI — НЕ проверенный ответ. Сверь каждый факт с первоисточником и конкурсными требованиями.</p>
                <p className="pitch-ai-draft__text">{draft.text}</p>
                <button type="button" onClick={() => void navigator.clipboard.writeText(draft.text)}>Копировать черновик</button>
              </div>
            )}
            <p className="pitch-ai-draft__hint">Использует только один выбранный подготовленный ответ и контекст активного питчдека. Ничего не отправляется в облачный Soniox.</p>
          </li>}
          {!contextMode && (hits.length === 0
            ? <li className="pitch-search-empty">{t('searchEmpty')}</li>
            : hits.map((hit, index) => renderHit(hit, index)))}
          {contextMode && qaGroups.alternatives.length > 0 && (
            <li className="pitch-qa-more">
              <details>
                <summary>Другие совпадения ({qaGroups.alternatives.length}) — показать по запросу</summary>
                <ul className="pitch-qa-alternatives">
                  {qaGroups.alternatives.map((hit, index) => renderHit(hit, index + (qaGroups.primary ? 1 : 0)))}
                </ul>
              </details>
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}

export default PitchSearch;
