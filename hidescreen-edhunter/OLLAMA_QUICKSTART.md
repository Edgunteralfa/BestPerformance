# Ollama + BestPerformance — Quick Start / Инструкция

**Status:** Experimental functionality in `experiment/b25-contextual-qa`, not in the released v1.3.0 binaries. **This repository does not contain private Q&A databases, user configurations or backups.**

## English

### What Ollama does in BestPerformance

BestPerformance can use a **local embedding model** for semantic search across your authored Q&A notes, with BM25 keyword ranking. It displays **your saved answer**, not an invented answer. A separate **chat model** can optionally produce an **UNVERIFIED AI draft** only when explicitly enabled and requested. AI draft mode is **off by default**.

### Install and configure

1. Install and start [Ollama](https://ollama.com/download) for Windows or macOS. Check the service with `ollama --version` and `ollama list`.
2. Download a compact **embedding** model:

```sh
ollama pull qwen3-embedding:0.6b
ollama list
```

3. Open BestPerformance → **Settings → Semantic Q&A Search / Ollama**. Enable semantic search. Use `http://127.0.0.1:11434` and enter exactly `qwen3-embedding:0.6b`. Click **Проверить модель**.
4. Select Q&A source tabs under **Что индексировать**, then wait for the index progress to reach ready. Indexing and model inference run on your computer.
5. Write explicit prepared answer variants:

```text
Q: Have you completed a factory pilot?
A_SHORT: Not yet. We have completed isolated engineering validation.
A_MEDIUM: Controlled industrial validation is the next step; customer outcomes are not yet measured.
```

6. Start with candidate threshold **0.52** and primary-answer threshold **0.65**. These are retrieval thresholds, **not factual confidence**. Changing the embedding model can change similarity scores.

**Important:** entering/pasting text in BP's ordinary search bar performs **literal substring search**, not semantic lookup. The optional **Sokuji B25** integration passes finalized translated full questions to BP's local semantic Q&A receiver on `127.0.0.1:47632`. It supports manual or automatic forwarding. You can still search exact phrases without Sokuji.

### Lightweight models

Approximate download sizes from the official Ollama library. Download size is **not** peak RAM usage.

| Purpose | Install command | Approx. download | Notes |
| --- | --- | ---: | --- |
| **Recommended first embedding model** | `ollama pull qwen3-embedding:0.6b` | 639 MB | Compact multilingual search |
| **Larger embedding model used in BP tests** | `ollama pull qwen3-embedding:4b` | 2.5 GB | More demanding; useful for comparing paraphrase retrieval |
| Alternative multilingual embedding | `ollama pull embeddinggemma` | 622 MB | Ollama v0.11.10+ |
| Small mainly English embedding | `ollama pull nomic-embed-text` | 274 MB | Test quality on multilingual content |
| Optional light AI-draft chat | `ollama pull qwen3:1.7b` | 1.4 GB | Generation only, not embeddings |
| Optional non-thinking AI-draft chat | `ollama pull qwen3:4b-instruct-2507-q4_K_M` | 2.5 GB | Larger generation model |
| Optional alternative AI-draft chat | `ollama pull llama3.2:3b` | 2.0 GB | Generation only |

Model pages: [Qwen3 Embedding](https://ollama.com/library/qwen3-embedding), [EmbeddingGemma](https://ollama.com/library/embeddinggemma), [Nomic](https://ollama.com/library/nomic-embed-text), [Qwen3](https://ollama.com/library/qwen3), [Llama 3.2](https://ollama.com/library/llama3.2).

**Do not use a chat model as the embedding model, or vice versa.** Select the model according to your machine and compare retrieval using real questions. Larger is not automatically better for a particular bank.

### Optional AI drafts

To experiment, pull a separate chat model such as `qwen3:1.7b`, select it under the **separate answer-model** setting, and enable draft generation. The **Сформировать черновик** control uses retrieved authored evidence. The draft is labeled **UNVERIFIED**, can still hallucinate or misrepresent facts, and must be checked before use. For live jury Q&A, prefer reviewed prepared `A_SHORT` and `A_MEDIUM` answers.

### Troubleshooting and privacy

- If model check fails: confirm Ollama is running, `ollama list` shows the exact model, and the endpoint is `http://127.0.0.1:11434`.
- Changed notes or model tags trigger index updates. Use **Переиндексировать выбранное** if needed; **Очистить кеш векторов** deletes cached embeddings, not notes.
- If semantic matches are too weak, review the source Q&A and the translated question before lowering thresholds.
- **Never commit** private Q&A banks, app `config.json`, local databases, cached vectors, backup copies, passwords, customer information or unpublished inventions into the public repository.
- A macOS build does not guarantee exclusion from screen capture: see the macOS warning in the main README.

Technical design and index lifecycle: [OLLAMA_SEMANTIC_SEARCH.md](OLLAMA_SEMANTIC_SEARCH.md).

---

## Русский

### Быстрый запуск

1. Установи [Ollama](https://ollama.com/download) для Windows или macOS и запусти. Проверь `ollama --version`.
2. Для **поиска по смыслу** установи embedding-модель:

```sh
ollama pull qwen3-embedding:0.6b
ollama list
```

3. В BP открой **Настройки → Semantic Q&A Search / Ollama**, включи семантический поиск. Адрес — `http://127.0.0.1:11434`, модель — `qwen3-embedding:0.6b`. Нажми **Проверить модель**.
4. В разделе **Что индексировать** выбери вкладки с готовыми вопросами. Дождись завершения индексации.
5. Формат банка: `Q:`, `A_SHORT:`, `A_MEDIUM:` и, при необходимости, `A_DETAILED:`. BP показывает подготовленные человеком версии ответов.
6. Начальные пороги: **0,52** — дополнительные совпадения, **0,65** — основной ответ. Similarity **не** означает достоверность содержания.

**Какую модель выбрать:** для обычного ноутбука начни с `qwen3-embedding:0.6b` (≈639 МБ). Если ресурсов больше и качество не устраивает — попробуй `qwen3-embedding:4b` (≈2,5 ГБ): именно 4B использовалась в предыдущих тестах BP. Альтернативы: `embeddinggemma` (≈622 МБ) и `nomic-embed-text` (≈274 МБ, прежде всего для английского). Модели могут давать разные similarity и требовать полной переиндексации.

**Для AI-черновиков** нужна *другая* модель: например, `ollama pull qwen3:1.7b` (≈1,4 ГБ). Черновики отключены по умолчанию, не заменяют готовые ответы и всегда требуют проверки. Нельзя выдавать сгенерированные утверждения за подтверждённые результаты.

**Важное отличие:** при ручной вставке текста в обычную строку BP работает буквальный поиск, **не семантический**. Контекстный семантический поиск запускается при передаче законченного переведённого вопроса из **Sokuji B25** через локальный порт `127.0.0.1:47632`.

**Если не работает:** проверь `ollama list`, доступность локального сервиса, имя модели и статус индексации. Можно переиндексировать вкладки или очистить кеш векторов — это **не удаляет** исходные заметки.

**Приватность:** твои базы Q&A, `config.json`, резервные копии, ключи и патентно-чувствительные материалы **не отправляются на GitHub и не входят в сборки**. Ollama работает локально; интернет нужен для начального скачивания моделей. Не публикуй содержимое личных баз в публичных репозиториях.
