# Local semantic Q&A search — Ollama (experimental)

The semantic search option is **off by default**. It uses a user-chosen Ollama embedding model installed locally, and does not require sending the user's pitch or Q&A materials to a cloud service.

## Set up

1. Run Ollama and install an embedding-capable model (`ollama pull qwen3-embedding:4b` is only an example; no model is bundled with BestPerformance).
2. Open BestPerformance → Settings → **Semantic Q&A Search / Ollama** and enable it.
3. Under **Что индексировать**, check individual current-pitch tabs, or use **Выбрать все / Снять все**. This choice is **separate from the normal search tab filter** and saved in each named pitch's snapshot.
4. Leave **Индексировать текст питча и свободные заметки** enabled for mixed content. Turn it off to index only detected `Q:`/`A:` question-answer passages (questions ending in `?` are also recognized).
5. Set the local Ollama address (usually `http://127.0.0.1:11434`), pick the model, and click **Проверить модель**.
6. A full English question from Sokuji is sent locally to BestPerformance on `127.0.0.1:47632`. The legacy LinguaRelay single-word search on port `47631` remains independent.
7. Search results display the **original saved answer**, source tab, and cosine similarity (not verified correctness). Select a result to jump to the note line.

## Index lifecycle

- **Automatic update:** changed note text, new/deleted/renamed tabs, source checkbox changes, switching pitch memory, changing model or endpoint, or changing the Q&A-only switch invalidates the old search snapshot.
- **Debounce:** the index synchronizes after roughly 900 ms without a further source or settings edit; Ollama is not called per keystroke.
- **Incremental embedding reuse:** individual unchanged question/answer chunks are reused from a local IndexedDB vector cache. Edited/new chunks are reembedded; deleted and unselected chunks immediately disappear from the active in-memory index. Unreferenced cached chunks may remain on disk until clearing the cache.
- **Model version:** BP reads the Ollama model digest at startup/selection and checks it periodically while enabled. If the tag points to new weights, previous vector entries are not reused.
- **Manual reindex:** **Переиндексировать выбранное** forces new vectors for the chosen sources. **Очистить кеш векторов** deletes all locally cached embeddings and causes a fresh build. Neither action deletes original notes or saved pitches.
- **Freshness:** an index from a different source scope, changed text, or different embedding model is never used as a semantic result. During sync or if Ollama fails, the existing lexical whole-question search is the labeled fallback. If no tabs are selected, semantic search returns no results after the empty scope is activated.
- **Progress:** Settings → Semantic Q&A Search displays a live status, percent complete, processed/total chunks, cached vectors, newly computed embeddings, and indexed tabs. The progress also appears in the search results area. During model checks and edit debounce, the stage is shown without inventing a percent. Large collections may need time for initial indexing.

## Recommended note format

```text
Q: How do you handle delays from suppliers?
A: We prepare a controlled recovery proposal for human approval.

Q: How is the solution integrated with ERP?
A: The system supports integration with existing enterprise systems.
```

Entries are chunked by logical question and its adjacent original answer. Long answers yield additional searchable text chunks linked to the same original note. Non-Q&A text is indexed as excerpts only if that option is enabled. No generative model fabricates new answers.

## Release and security

- Configurable endpoint and model; **no hard-coded B25 model**. Loopback HTTP endpoints are allowed and network redirects and proxies are disabled in native code; remote hosts are intentionally unsupported.
- All notes and embeddings stay on the user's computer. The vector cache is stored in WebView IndexedDB and is **not separately encrypted**; clear it in Settings if needed.
- Switching pitch memories restores each pitch's own indexing source selection.
- This build uses cosine similarity over a local in-memory vector index and **does not include a dedicated reranker or scalable ANN/vector database**. For tens of thousands of chunks, benchmark indexing time, app memory, and result quality before release.
- Similarity is a ranking signal, not factual confidence. Review the stored answer before delivering it in competition Q&A.

## Experimental Hybrid Q&A Copilot (2026-10-27)

- The full English question receiver (`127.0.0.1:47632`) now combines Ollama embedding similarity and in-memory BM25 over indexed content, using reciprocal rank fusion (RRF). This is **not yet a separate neural reranker**. The original one-word lookup (`47631`) remains unchanged.
- Ranked cards show the source tab, original English question, match method, and **original stored answer**. The view selector offers shortened excerpt / standard excerpt / complete unmodified answer. Copy always copies the full stored original.
- Keyboard shortcuts while the search input is focused: keys `1`, `2`, `3` jump to the corresponding top result; arrow keys and Enter retain their original function.
- Evidence badges `VERIFIED`, `DECLARED`, `OBSERVED` appear **only** when the stored source text explicitly contains the matching bracketed label. The application never determines the status itself.
- The embedded model tag is chosen by the user; there is no hard-coded product-specific model. Answers are **retrieved, not generated**.
- Sokuji B25 provides an optional, off-by-default `Auto Q&A → BP` switch. It sends only finalized question-shaped English translations from the other participant to the local BestPerformance TCP receiver, after a short delay and with per-question deduplication. No added Soniox audio stream. This is experimental and should be tested live before competitions.
- Not included yet: dedicated reranker, calibrated confidence, reliable real-world Recall@3 benchmark, or generated multi-length answers. Do not interpret cosine similarity as factual confidence.

## Manual/automatic lookup & prepared answer lengths (2026-10-27)

**Sokuji B25**: Open display settings (gear near subtitles/conversation) → **BestPerformance — поиск ответов** → **Вручную** or **Автоматически**. The quick `Auto Q&A → BP` switch in the main Sokuji panel controls the same persisted setting. Manual magnifier lookup always works; auto mode sends only a newly finalized English question from the other participant to the loopback BP receiver. Auto is off by default.

**BestPerformance**: Settings → **Semantic Q&A Search / Ollama** → **Длина ответа при открытии результатов**. Choose **Коротко / Средне / Полностью** as a persisted default. Each retrieved answer card also has its own independent three-button selector, and the quick toolbar changes all currently displayed cards until the next question. No embedding reindex is necessary when switching the visible answer length.

Optionally write three *separate, authored* answer versions in an English Q&A tab:

```text
Q: How do you check readiness for industrial validation?
A_SHORT: We review documented engineering readiness.
A_MEDIUM: We confirm implemented functionality and review engineering evidence before controlled validation.
A_DETAILED: The implemented runtime and engineering checks support controlled pre-pilot readiness. We will measure actual outcomes during an approved pilot.
```

The three authored versions are indexed with the question, retained locally and shown **verbatim** on selection. If the author did not supply separate versions, **Коротко** and **Средне** show shorter excerpts of the available original answer, and **Полностью** shows the full original. Shortened excerpts are **not** separately approved answer formulations. The copy control copies the full selected authored variant, or the original full answer when an excerpt is shown. No AI synthesizes or revises factual claims.

## Local opt-in English AI draft answers and competition context

- The user can independently select an Ollama **chat-generation model** in BestPerformance Settings → Semantic Q&A Search / Ollama. The embedding model remains a separate setting. Enable `Разрешить генерацию черновика ответа` (off by default).
- Enter the current competition's public-safe background in **Контекст активного питчдека**. It is included in named pitch snapshots and restored on pitch switching. The Soniox contest profile in Sokuji is **separate**; no automatic cross-application sync is implemented yet.
- The `Сформировать черновик` button uses the current English question and up to four matched question/answer source passages. It refuses to generate without retrieved prepared answer text. The original prepared answer cards remain visible; it does not generate on every recognized question or replace their source text.
- Native Tauri Rust command `local_ollama_answer` calls `/api/chat` on a loopback-only Ollama instance. Custom remote endpoints, redirect chains, proxy and `:cloud` models are blocked for generation. Answer draft is visible only after the model completes; changed questions or pitchedeck context hide stale generated drafts.
- Local chat models, unlike embedding models, may be resource-intensive. On the test Windows PC `llama3.1:8b` generated a one-line factual reply in approximately 19 seconds on a cold first request. Prepared Q&A retrieval remains the primary fast response path.
- **Every generated output is clearly labeled UNVERIFIED AI draft**. The model is prompted not to fabricate awards, granted patents, funding, completed pilots, measurable results or market figures, and not to reveal unpublished implementation. Model compliance is not guaranteed; **human review is required**.
- This is an experimental feature. Run it only with material you are authorized to share with your local Ollama instance. No unapproved patent details, secrets or attorney materials should be entered in contest context.
