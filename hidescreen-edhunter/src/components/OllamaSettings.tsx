// MIT License - Copyright (c) 2026 BestPerformance Contributors
import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { clearSemanticCache } from '../semanticSearch';
import { indexPercent, useIndexProgress } from '../indexProgress';
import './OllamaSettings.css';
import type { NoteTab, SemanticSettings } from '../types';

export function OllamaSettings({
  value, onChange, tabs, excludedTabIds, onSourcesChange, contestContext, onContestContextChange,
}: {
  value: SemanticSettings;
  onChange: (next: SemanticSettings) => void;
  tabs: NoteTab[];
  excludedTabIds: string[];
  onSourcesChange: (next: string[]) => void;
  contestContext: string;
  onContestContextChange: (value: string) => void;
}) {
  const [models, setModels] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const progress = useIndexProgress();
  const percent = indexPercent(progress);
  const isWorking = progress.stage === 'indexing' || progress.stage === 'checking' || progress.stage === 'waiting';
  const set = (update: Partial<SemanticSettings>) => onChange({ ...value, ...update });

  const refresh = useCallback(async () => {
    setWorking(true); setMessage('');
    try {
      const found = await invoke<string[]>('local_ollama_models', { endpoint: value.endpoint });
      setModels(found);
      setMessage(found.length ? `Найдено моделей Ollama: ${found.length}. Выбирай только embedding-модель.`
        : 'Ollama доступна, но моделей пока нет.');
    } catch (error) {
      setModels([]);
      setMessage(`Не удалось подключиться к Ollama: ${String(error)}`);
    } finally { setWorking(false); }
  }, [value.endpoint]);

  useEffect(() => {
    if (!value.enabled) return;
    const timer = window.setTimeout(() => { void refresh(); }, 700);
    return () => window.clearTimeout(timer);
  }, [value.enabled, refresh]);

  const test = async () => {
    if (!value.model.trim()) { setMessage('Выбери embedding-модель.'); return; }
    setWorking(true);
    setMessage('Проверяю генерацию embeddings…');
    try {
      const vectors = await invoke<number[][]>('local_ollama_embed', {
        endpoint: value.endpoint, model: value.model, texts: ['How do you handle delayed deliveries?'],
      });
      setMessage(`Модель работает: ${vectors[0]?.length ?? 0} измерений. Передача только через localhost.`);
    } catch (error) { setMessage(`Ошибка модели: ${String(error)}`); }
    finally { setWorking(false); }
  };

  const prepare = async () => {
    if (!value.model.trim() || !value.answerModel.trim()) {
      setMessage('Выбери embedding-модель и отдельную chat-модель перед подготовкой.'); return;
    }
    setWorking(true);
    setMessage('Загружаю обе модели в Ollama и проверяю совместное размещение в памяти…');
    try {
      const result = await invoke<string>('local_ollama_prepare', {
        endpoint: value.endpoint, embeddingModel: value.model, answerModel: value.answerModel,
      });
      setMessage(result);
    } catch (error) { setMessage('Подготовка моделей не удалась: ' + String(error)); }
    finally { setWorking(false); }
  };

  const selected = tabs.filter(tab => !excludedTabIds.includes(tab.id));
  const selectAll = () => onSourcesChange([]);
  const selectNone = () => onSourcesChange(tabs.map(tab => tab.id));
  const toggleSource = (id: string, checked: boolean) =>
    onSourcesChange(checked
      ? excludedTabIds.filter(other => other !== id)
      : [...new Set([...excludedTabIds, id])]);

  const rebuild = () => {
    if (!value.model.trim()) { setMessage('Сначала выбери embedding-модель.'); return; }
    set({ revision: value.revision + 1 });
    setMessage('Запрошено полное перестроение: выбранные источники будут пересчитаны.');
  };
  const clear = async () => {
    setWorking(true);
    try {
      await clearSemanticCache();
      set({ revision: value.revision + 1 });
      setMessage('Локальный векторный кеш очищен; при следующей индексации будет создан заново.');
    } catch (error) { setMessage(`Не удалось очистить кеш: ${String(error)}`); }
    finally { setWorking(false); }
  };

  return (
    <section className="settings-section ollama-settings" data-testid="ollama-settings">
      <label className="checkbox-label">
        <input type="checkbox" checked={value.enabled} onChange={event => set({ enabled: event.target.checked })} />
        <strong>Semantic Q&A Search / Ollama</strong>
      </label>
      <p className="settings-hint">
        Смысловой поиск по твоим заметкам, вопросам и питчу. Обработка только на локальной Ollama.
        Обычный поиск работает отдельно. Выбор источников сохраняется для каждого питчдека.
      </p>

      <div style={{ marginTop: 12, display: 'grid', gap: 7 }}>
        <strong className="ollama-source-title">Что индексировать</strong>
        <p className="settings-hint" style={{ margin: 0 }}>
          Выбрано вкладок: {selected.length} из {tabs.length}. Эти чекбоксы не влияют на обычный поиск.
        </p>
        <div style={{ display: 'flex', gap: 7 }}>
          <button type="button" onClick={selectAll} disabled={selected.length === tabs.length}>Выбрать все</button>
          <button type="button" onClick={selectNone} disabled={selected.length === 0}>Снять все</button>
        </div>
        <div style={{
          display: 'grid', gap: 6, padding: 9, maxHeight: 180, overflowY: 'auto',
          border: '1px solid #8885', borderRadius: 6,
        }}>
          {tabs.map(tab => (
            <label key={tab.id} className="checkbox-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={!excludedTabIds.includes(tab.id)}
                onChange={event => toggleSource(tab.id, event.target.checked)} />
              <span style={{ overflowWrap: 'anywhere' }}>{tab.name}</span>
            </label>
          ))}
        </div>
        <label className="checkbox-label">
          <input type="checkbox" checked={value.includeExcerpts}
            onChange={event => set({ includeExcerpts: event.target.checked })} />
          Индексировать текст питча и свободные заметки (не только пары Q/A)
        </label>
      </div>

      <div style={{ display: 'grid', gap: 5, marginTop: 14 }}>
        <label htmlFor="semantic-ollama-endpoint">Локальный адрес Ollama</label>
        <input id="semantic-ollama-endpoint" type="text"
          value={value.endpoint} onChange={event => set({ endpoint: event.target.value })}
          placeholder="http://127.0.0.1:11434" disabled={working}
          style={{ width: '100%', boxSizing: 'border-box' }} />
        <label htmlFor="semantic-ollama-model">Embedding-модель Ollama</label>
        <select id="semantic-ollama-model" disabled={working}
          value={models.includes(value.model) ? value.model : '__custom__'}
          onChange={event => { if (event.target.value !== '__custom__') set({ model: event.target.value }); }}>
          <option value="__custom__">Ввести название модели вручную</option>
          {models.map(model => <option key={model} value={model}>{model}</option>)}
        </select>
        <input type="text" aria-label="Ollama embedding model name" disabled={working}
          value={value.model} onChange={event => set({ model: event.target.value })}
          placeholder="e.g. qwen3-embedding:4b" style={{ width: '100%', boxSizing: 'border-box' }} />
        <label htmlFor="semantic-minimum">Порог отбора кандидатов: {value.minimum.toFixed(2)} (не оценка достоверности)</label>
        <input id="semantic-minimum" type="range" min={0.25} max={0.85} step={0.01}
          value={value.minimum} onChange={event => set({ minimum: Number(event.target.value) })}/>
        <label htmlFor="semantic-main-minimum">Порог основного ответа: {Math.max(value.minimum, value.mainAnswerMinimum).toFixed(2)}</label>
        <input id="semantic-main-minimum" type="range" min={0.25} max={0.95} step={0.01}
          value={value.mainAnswerMinimum} onChange={event => set({ mainAnswerMinimum: Number(event.target.value) })}/>
        <p className="settings-hint" style={{ margin: 0 }}>Кандидаты от {value.minimum.toFixed(2)} доступны для ручной проверки. Основным может стать только подготовленный Q&A-ответ с семантическим совпадением от {Math.max(value.minimum, value.mainAnswerMinimum).toFixed(2)}. Оценка сходства не подтверждает достоверность фактов.</p>
      </div>

      <div className="ollama-answer-default" role="group" aria-label="Ответы по умолчанию">
        <strong>Длина ответа при открытии результатов</strong>
        <p className="settings-hint">Начальный режим для каждой карточки; внутри карточки можно изменить длину независимо.</p>
        <div className="ollama-answer-default__choices">
          {(['brief', 'normal', 'complete'] as const).map(detail => (
            <button key={detail} type="button"
              aria-pressed={value.defaultAnswerDetail === detail}
              className={value.defaultAnswerDetail === detail ? 'active' : ''}
              onClick={() => set({ defaultAnswerDetail: detail })}>
              {detail === 'brief' ? 'Коротко' : detail === 'normal' ? 'Средне' : 'Полностью'}
            </button>
          ))}
        </div>
        <p className="settings-hint">Если есть A_SHORT / A_MEDIUM / A_DETAILED — показываются подготовленные версии. Иначе это фрагменты одного исходного ответа, без генерации.</p>
      </div>

      <section className="ollama-answer-default" aria-label="AI draft answers">
        <label className="checkbox-label">
          <input type="checkbox" checked={value.generateAnswers}
            onChange={e => set({ generateAnswers: e.target.checked })}/>
          <strong>Разрешить генерацию черновика ответа (локальная Ollama)</strong>
        </label>
        <p className="settings-hint">
          Только по отдельной кнопке после поиска. Исходные ответы остаются рядом.
          Черновик не является подтверждённым фактом: проверь цифры, статус пилота и формулировки перед выступлением.
        </p>
        <label htmlFor="b25-answer-model">Отдельная модель для ответов (не embedding-модель)</label>
        <select id="b25-answer-model" value={models.includes(value.answerModel) ? value.answerModel : '__custom__'}
          onChange={e => { if (e.target.value !== '__custom__') set({ answerModel: e.target.value }); }}>
          <option value="__custom__">Ввести вручную</option>
          {models.map(model => <option key={model} value={model}>{model}</option>)}
        </select>
        <input aria-label="Название модели Ollama для ответов" type="text" value={value.answerModel}
          placeholder="e.g. llama3.1:8b" onChange={e => set({ answerModel: e.target.value.slice(0, 180) })}/>
        <div className="ollama-prepare-row">
          <button type="button" disabled={working || !value.model.trim() || !value.answerModel.trim()}
            onClick={() => void prepare()}>
            {working ? 'Подготовка моделей…' : 'Подготовить обе модели к Q&A'}
          </button>
          <span>Предзагрузка без генерации ответа. Проверка памяти Ollama, удержание до 30 минут при наличии ресурсов.</span>
        </div>
        <label htmlFor="b25-contest-context">Контекст активного питчдека для подготовки ответа</label>
        <textarea id="b25-contest-context" rows={5} maxLength={6000}
          placeholder="Конкурс, трек, критерии оценки, проверенные TAM / SAM / SOM с единицами измерения и источниками, ограничения публичного раскрытия..."
          value={contestContext} onChange={e => onContestContextChange(e.target.value)}/>
        <p className="settings-hint">
          Этот контекст хранится с питчдеком и передаётся только в выбранную локальную модель Ollama.
          Он не добавляется в контекст Soniox. Не вводи секреты, патентоспособные механизмы
          или неподтверждённые результаты как факты.
        </p>
      </section>

      <div className="ollama-index-progress" role="status" aria-live="polite" aria-atomic="true" data-testid="ollama-index-progress">
        <div className="ollama-index-progress__headline">
          <strong>{progress.stage === 'ready' ? 'Индекс готов' : progress.stage === 'indexing' ? 'Индексация выполняется' : progress.stage === 'waiting' ? 'Ожидание обновления' : progress.stage === 'checking' ? 'Подключение к Ollama' : progress.stage === 'error' ? 'Ошибка индексации' : progress.stage === 'empty' ? 'Источники не выбраны' : progress.stage === 'no-model' ? 'Модель не выбрана' : 'Индексация отключена'}</strong>
          <span className="ollama-index-progress__percent">{progress.stage === 'indexing' || progress.stage === 'ready' || progress.stage === 'empty' ? `${percent}%` : isWorking ? '…' : '—'}</span>
        </div>
        <progress
          className="ollama-index-progress__bar"
          max={100}
          value={progress.stage === 'checking' || progress.stage === 'waiting' ? undefined : percent}
          aria-label="Прогресс индексации Ollama"
        />
        <p className="ollama-index-progress__detail">{progress.detail}</p>
        {(progress.stage === 'indexing' || progress.stage === 'ready') && (
          <div className="ollama-index-progress__stats">
            <span>Фрагменты: {progress.processed} / {progress.total}</span>
            <span>Из кеша: {progress.cached}</span>
            <span>Новые: {progress.generated}</span>
            <span>Вкладки: {progress.tabs}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
        <button type="button" onClick={() => void refresh()} disabled={working}>Обновить список моделей</button>
        <button type="button" onClick={() => void test()} disabled={working || !value.model.trim()}>Проверить модель</button>
        <button type="button" onClick={rebuild} disabled={!value.model.trim() || !selected.length}>Переиндексировать выбранное</button>
        <button type="button" onClick={() => void clear()} disabled={working}>Очистить кеш векторов</button>
      </div>
      <p className="settings-hint">
        Индекс синхронизируется автоматически после изменений текстов, вкладок и выбранной модели.
        Меняется только затронутая часть: неизменённые векторы используются из кеша.
        После переключения питчдека активируется индекс его выбранных вкладок.
        Прогресс отображается здесь и рядом с результатами поиска.
      </p>
      <p role="status" className="settings-hint">{message || (selected.length
        ? 'При обновлении весов модели под прежним названием нажми «Переиндексировать выбранное».'
        : 'Ни одна вкладка не выбрана. Семантический поиск не будет выдавать результаты.')}</p>
    </section>
  );
}
