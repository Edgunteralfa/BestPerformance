# Changelog

## 1.4.0

- Added opt-in local semantic Q&A search using Ollama embeddings and hybrid BM25 matching across selected tabs. BP retrieves the original prepared answers; similarity is not factual confidence.
- Added authored `A_SHORT`, `A_MEDIUM`, and `A_DETAILED` answer variants, separate candidate and primary-answer thresholds, match diagnostics, and incremental local vector caching.
- Added optional local full-question integration with Sokuji B25. Sokuji is a separate app, not included with BestPerformance.
- Added optional Ollama chat-generated UNVERIFIED AI drafts with human review required; disabled by default.
- Added per-pitch source selection, contest context, safer partial import, indexing progress, tests, and bilingual Ollama setup guidance.
- Personal Q&A banks, local configuration and backups are not bundled or uploaded. Ollama models must be installed separately.
- The unsigned macOS build may appear in screen recordings on macOS 15.4 and later.

## 1.3.0

- Three ways to read the same script. Notes is the full text. Beat shows one chapter. Glide keeps the line you are saying near the top, close to the camera, and does not pull the window forward.
- Glide follows the time set on that chapter. If the chapter has no time, it uses the last rehearsal. A chapter title is not read. A line that starts with `//` or `[cue]`, and a note from the second highlight, is crossed smoothly and does not take the chapter time.
- The wheel pauses Glide. Play continues from that line. At the end of a chapter the button becomes an arrow to the next one. Choosing a chapter in the list starts there.
- Each tab keeps its own Notes, Beat, or Glide. Switching tabs does not start Glide by itself.
- A setting starts the chapter timer with Glide. It is off until you turn it on. Play starts both, pause stops both, and choosing a chapter starts that chapter's clock from the top.
- The interface is in fifteen languages. The first launch follows the system language. Arabic reads from the right, and the chapter list moves to the right. Clocks stay as `1:30`.
- Reading modes can be hidden from the main window. The last mode stays.

## 1.2.1

- The update check uses the version of the build itself. After 1.2.1 is installed, the app no longer asks to install 1.2.0 again.

## 1.2.0

- Halfway through a chapter the label turns blue and the window edge flashes blue once. Orange and red still mark the short remainder and the end.
- One minute left, then thirty seconds, for the whole talk. At thirty seconds the total clock pulses orange. Both notes start on, and each has its own checkbox.
- The window opens where you left it, at the size you left it. A first launch, or the old 400 by 200 size, opens at 800 by 400.
- Hide the shared pointer over the notes. It starts off. Their cursor disappears at the edge. You still see a pointer and can still click. The same switch covers the facts window.
- Select a word and right-click to color it. Line colors stay. The same colors show in the chapter list. Notes and settings already saved stay where they are.
- The facts window scrolls with the same thin dark bar as the chapter list.
- A search hit opens on that line. The matched words flash blue twice, so a long question still shows which word was found. If that chapter was outside the left list, the list scrolls until the heading is in view.

## 1.1.0

- Hide buttons and sliders you do not need. The last setting stays.
- Search only the tabs you check. Each talk remembers its own.
- Color a chapter in the list, and keep a separate list width on each tab.
- The last chapter can scroll to the top, so its timer starts.
- Rehearse from the chapter list, and jump back from the questions tab.
- The timer turns orange, then red. The window edge flashes the same way.
- Save one talk as JSON, or as text for a notepad. JSON is what comes back into the app.
- Settings scroll as one list. File export and the tag color each sit on one button.
- The update button downloads the installer itself, then starts it.

## 1.0.0

- First public release. A notes window for talks and calls, on top of other programs, and on Windows left out of screen capture.

# История изменений

## 1.4.0

- Добавлен необязательный локальный семантический поиск готовых ответов с Ollama embeddings и BM25 по выбранным вкладкам. BP показывает исходные ответы; similarity не является показателем достоверности.
- Добавлены подготовленные варианты `A_SHORT`, `A_MEDIUM`, `A_DETAILED`, раздельные пороги кандидатов и основного ответа, диагностика совпадений и локальный кеш векторов.
- Добавлена передача вопросов из Sokuji B25 по локальному интерфейсу. Sokuji — отдельная программа и не входит в комплект BestPerformance.
- Добавлены необязательные UNVERIFIED AI-черновики с отдельной Ollama chat-моделью и обязательной проверкой человеком; по умолчанию выключены.
- Добавлены выбор вкладок для индексации, контекст конкурса, безопасный частичный импорт, статус индексации, тесты и двуязычная инструкция Ollama.
- Личные Q&A-базы, конфигурации и резервные копии не включаются в сборки и не отправляются на GitHub. Ollama нужно установить отдельно.
- Неподписанная сборка macOS может попадать в записи экрана на macOS 15.4 и новее.

## 1.3.0

- Три способа читать один и тот же текст. «Текст» показывает всё. «Такт» оставляет одну главу. «Ход» держит произносимую строку у верхнего края, ближе к камере, и сам не вытаскивает окно вперёд.
- «Ход» идёт по времени, заданному главе. Если времени нет, берётся последняя репетиция. Название главы не читается. Строка с `//` или `[cue]` и строка второго цвета проезжаются плавно и не забирают время главы.
- Колесо ставит «Ход» на паузу. Пуск продолжает с той же строки. В конце главы кнопка становится стрелкой на следующую. Выбор главы в списке начинает с неё.
- У каждой вкладки свой «Текст», «Такт» или «Ход». При переключении «Ход» сам не запускается.
- В настройках можно запускать таймер главы вместе с «Ходом». Сначала галочка снята. Пуск включает оба, пауза останавливает оба, а выбор главы начинает её часы сначала.
- Интерфейс на пятнадцати языках. Первый запуск берёт язык системы. Арабский читается справа налево, и список глав встаёт справа. Часы остаются как `1:30`.
- Режимы чтения можно убрать с главного окна. Последний режим остаётся.

## 1.2.1

- Проверка обновления берёт номер самой сборки. После установки 1.2.1 программа больше не предлагает поставить 1.2.0 ещё раз.

## 1.2.0

- На половине времени главы подпись становится синей, и край окна один раз мигает синим. Оранжевый и красный по-прежнему отмечают короткий остаток и конец.
- На всём выступлении отдельно звучат «осталась минута» и «осталось тридцать секунд». На тридцати секундах общие часы пульсируют оранжевым. Обе подсказки включены сразу, и у каждой своя галочка.
- Окно открывается там, где его оставили, и того же размера. Первый запуск, или старый размер 400 на 200, открывается как 800 на 400.
- Можно спрятать курсор от собеседника. Сначала выключено. Над окном заметок его стрелка пропадает у границы. Свою стрелку вы видите и по-прежнему можете нажимать. Та же кнопка действует на окно цифр.
- Выделите слово и правой кнопкой задайте ему цвет. Цвета строк остаются. Те же цвета видны в списке глав слева. Уже сохранённые заметки и настройки остаются на месте.
- Окно цифр прокручивается такой же тонкой тёмной полосой, как список глав.
- Результат поиска открывается на своей строке. Найденные слова дважды мигают синим, так что в длинном вопросе видно, какое слово нашлось. Если глава была вне левого списка, список прокручивается, пока заголовок не окажется в поле зрения.

## 1.1.0

- Можно спрятать лишние кнопки и ползунки. Последняя настройка остаётся.
- Поиск только по отмеченным вкладкам. У каждого выступления свой выбор.
- Цвет главы в списке слева и своя ширина этого списка у каждой вкладки.
- Последняя глава доезжает до верхнего края, и её таймер начинается.
- Репетиция по списку глав и возврат из вкладки с вопросами.
- Таймер сначала оранжевый, потом красный. Край окна мигает так же.
- Одно выступление можно сохранить как JSON или как текст для блокнота. Обратно в программу возвращается JSON.
- Настройки прокручиваются одним списком. Файл и цвет тега открываются с одной кнопки.
- Кнопка обновления сама скачивает установщик и запускает его.

## 1.0.0

- Первый публичный выпуск. Окно заметок для выступлений и созвонов, поверх остальных программ, и на Windows вне записи экрана.
