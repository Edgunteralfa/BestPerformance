/* eslint-disable react-refresh/only-export-components -- context module also exports helpers */
import { createContext, useContext, type ReactNode } from 'react';

export type Language = 'en' | 'ru';

const en = {
  settings: 'Settings',
  close: 'Close',
  opacity: 'Opacity',
  opacityHint: 'This slider changes the main window. The facts window has its own slider in the title bar.',
  titleOpacity: 'Opacity of this window',
  font: 'Font',
  fontFamily: 'Family:',
  fontSize: 'Size:',
  fontUnit: 'pt',
  textColor: 'Body text',
  headingColor: 'Heading color',
  markColor: 'Highlight color',
  noteColor: 'Second highlight',
  headingHint: 'H marks a heading. The two colored buttons mark the current line with the highlight colors. Press the same button again to clear it.',
  toggleHeading: 'Mark this line as a heading',
  toggleMark: 'Mark this line with the highlight color',
  toggleNote: 'Mark this line with the second highlight',
  backgroundColor: 'Background Color',
  updates: 'Updates',
  checkUpdates: 'Check for updates on startup',
  language: 'Language',
  altTab: 'Name in Alt+Tab',
  altTabHint: 'Both windows use this name in the share list. On Windows it is also the Alt+Tab name, while the title inside the window stays BestPerformance. On macOS it is the Mission Control label and the title inside the window. The Mac app is not listed in the Dock or Cmd+Tab.',
  upToDate: 'up to date',
  updateInstall: 'v{version} is out — install',
  docs: 'Docs & Help',
  notice: 'Notice',
  cancel: 'Cancel',
  save: 'Save',
  updateBadge: 'v{version} available',
  updateTooltip: 'Update available: v{version}',
  upToDateTooltip: 'Up to date',
  decreaseFont: 'Decrease font size',
  increaseFont: 'Increase font size',
  tabs: 'Tabs',
  tabHint: 'Each tab has its own notes, name, and color. The name and color here are separate from the text colors. Click a colored name at the top to switch.',
  chapters: 'Chapters',
  chapterEmpty: 'Put the cursor on a question and press H. That line appears here.',
  timerStart: 'Start',
  timerPause: 'Pause',
  timerReset: 'Reset',
  timerReview: 'Review',
  reviewTitle: 'Rehearsal',
  reviewEmpty: 'Start the timer and walk the chapters. Spent time shows up here.',
  reviewOpen: '{spent}',
  reviewOk: '{spent} of {plan}',
  reviewOver: '{spent}, over {over}',
  reviewPitch: 'Whole pitch',
  timerTotal: 'Total {time}',
  timerLeft: 'Left {time}',
  timerOver: 'Over {time}',
  timerChapter: 'Chapter {time}',
  timerChapterLeft: 'Chapter {time}',
  timerChapterOver: 'Chapter over {time}',
  cardToggle: 'Numbers and definitions',
  cardTitle: 'Facts and details',
  cardPlaceholder: '12% — conversion\nARR — annual recurring revenue',
  pitchLength: 'Pitch length',
  pitchHint: 'How long the whole pitch may run, as m:ss. 0:00 shows elapsed time instead of a countdown. Each chapter time is set beside its name in the left list.',
  pitchMemory: 'Saved pitches',
  pitchMemoryHint: 'Stores the tabs, chapter times, and the facts window. Opening another pitch keeps the one you are writing.',
  pitchMemoryName: 'Pitch name',
  pitchMemoryTag: 'Tag',
  pitchMemorySave: 'Remember',
  pitchMemoryOpen: 'Open',
  pitchMemoryCurrent: 'Current',
  pitchMemoryDelete: 'Delete',
  pitchMemoryDeleteTitle: 'Delete this pitch?',
  pitchMemoryDeleteConfirm: 'Delete “{name}” from saved pitches? The pitch on screen stays as it is.',
  pitchMemoryFull: 'Thirty pitches are already saved. Delete one before remembering another.',
  pitchDraftName: 'Draft',
  addTab: 'Add tab',
  removeTab: 'Remove',
  tabDefault: 'Notes',
  clearText: 'Clear the current tab',
  clearConfirmTitle: 'Clear this tab?',
  clearConfirm: 'Erase the notes in the open tab only? The other tabs stay as they are.',
  clear: 'reset',
  lock: 'Lock: clicks pass through the window',
  unlock: 'Unlock: clicks hit this window again',
  placeholder: 'Write your notes… H is a heading, the colored buttons highlight a line.',
  noticeTitle: '{app} — please read',
  updateTitle: '{app} update',
  updatePrompt: 'Version v{version} is out.\n\nDownload and install it now?',
  ethicalNotice:
    '{app} keeps a private script on your own screen during a talk or a call.\n\n' +
    'Leave it unused for exams, for breaking a school or office rule, for sidestepping a service agreement, and for anything the law forbids.\n\n' +
    'How you use it is your decision.\n\n' +
    'Notes stay in a file on this PC. The only optional outbound request is an update check.\n\n' +
    'OK means you have read this.',
};

const ru: typeof en = {
  settings: 'Настройки',
  close: 'Закрыть',
  opacity: 'Непрозрачность',
  opacityHint: 'Этот ползунок меняет главное окно. У окна «Цифры и детали» свой ползунок в шапке.',
  titleOpacity: 'Непрозрачность этого окна',
  font: 'Шрифт',
  fontFamily: 'Гарнитура:',
  fontSize: 'Размер:',
  fontUnit: 'пт',
  textColor: 'Основной текст',
  headingColor: 'Цвет заголовка',
  markColor: 'Цвет выделения',
  noteColor: 'Второй цвет',
  headingHint: 'H делает строку заголовком. Две цветные кнопки красят текущую строку цветами выделения. Повторное нажатие той же кнопки снимает цвет.',
  toggleHeading: 'Сделать строку заголовком',
  toggleMark: 'Покрасить строку цветом выделения',
  toggleNote: 'Покрасить строку вторым цветом',
  backgroundColor: 'Цвет фона',
  updates: 'Обновления',
  checkUpdates: 'Проверять обновления при запуске',
  language: 'Язык интерфейса',
  altTab: 'Имя в Alt+Tab',
  altTabHint: 'Оба окна показываются под этим именем в списке «поделиться». На Windows это же имя в Alt+Tab, а внутри окна остаётся BestPerformance. На macOS это подпись в Mission Control и текст в шапке окна. В Dock и в Cmd+Tab приложение не появляется.',
  upToDate: 'актуальная версия',
  updateInstall: 'вышла v{version} — установить',
  docs: 'Справка',
  notice: 'Предупреждение',
  cancel: 'Отмена',
  save: 'Сохранить',
  updateBadge: 'есть v{version}',
  updateTooltip: 'Доступно обновление: v{version}',
  upToDateTooltip: 'Актуальная версия',
  decreaseFont: 'Уменьшить шрифт',
  increaseFont: 'Увеличить шрифт',
  tabs: 'Вкладки',
  tabHint: 'У каждой вкладки свой текст, своё название и свой цвет. Название и цвет вкладки задаются здесь и не связаны с цветами текста. Сверху нажмите цветное название, чтобы переключиться.',
  chapters: 'Главы',
  chapterEmpty: 'Поставьте курсор на вопрос и нажмите H. Строка появится в этом списке.',
  timerStart: 'Старт',
  timerPause: 'Пауза',
  timerReset: 'Сброс',
  timerReview: 'Итог',
  reviewTitle: 'Итог репетиции',
  reviewEmpty: 'Запусти таймер и пройди главы. Здесь появится, сколько ушло на каждую.',
  reviewOpen: '{spent}',
  reviewOk: '{spent} из {plan}',
  reviewOver: '{spent}, сверх {over}',
  reviewPitch: 'Весь питч',
  timerTotal: 'Всего {time}',
  timerLeft: 'Осталось {time}',
  timerOver: 'Сверх {time}',
  timerChapter: 'Глава {time}',
  timerChapterLeft: 'Глава {time}',
  timerChapterOver: 'Глава сверх {time}',
  cardToggle: 'Цифры и определения',
  cardTitle: 'Цифры и детали',
  cardPlaceholder: '12% — конверсия\nARR — годовая выручка',
  pitchLength: 'Длина питча',
  pitchHint: 'Сколько может длиться весь питч, в виде м:сс. 0:00 показывает прошедшее время. Время каждой главы задаётся справа от её названия в левом списке.',
  pitchMemory: 'Память питчей',
  pitchMemoryHint: 'Запоминает вкладки, время глав и окно «Цифры и детали». Когда открываешь другой питч, текущая заготовка остаётся в списке.',
  pitchMemoryName: 'Название питча',
  pitchMemoryTag: 'Тег',
  pitchMemorySave: 'Запомнить',
  pitchMemoryOpen: 'Открыть',
  pitchMemoryCurrent: 'Сейчас',
  pitchMemoryDelete: 'Удалить',
  pitchMemoryDeleteTitle: 'Удалить этот питч?',
  pitchMemoryDeleteConfirm: 'Удалить «{name}» из памяти? То, что сейчас на экране, останется.',
  pitchMemoryFull: 'Уже сохранено тридцать питчей. Удалите один, чтобы запомнить новый.',
  pitchDraftName: 'Черновик',
  addTab: 'Добавить вкладку',
  removeTab: 'Удалить',
  tabDefault: 'Заметки',
  clearText: 'Очистить текст текущей вкладки',
  clearConfirmTitle: 'Очистить эту вкладку?',
  clearConfirm: 'Стереть текст только открытой вкладки? Остальные вкладки не изменятся.',
  clear: 'очистить',
  lock: 'Заблокировать: клики проходят сквозь окно',
  unlock: 'Снять блокировку: клики снова попадают в окно',
  placeholder: 'Напишите заметку… H — заголовок, цветные кнопки выделяют строку.',
  noticeTitle: '{app} — важно прочитать',
  updateTitle: 'Обновление {app}',
  updatePrompt: 'Вышла версия v{version}.\n\nСкачать и установить сейчас?',
  ethicalNotice:
    '{app} держит текст питча на вашем экране во время разговора или выступления.\n\n' +
    'Не берите её на экзамен, не нарушайте ею правила учёбы или работы, не обходите чужие условия сервиса и не делайте того, что запрещено законом.\n\n' +
    'Решение, как ей пользоваться, остаётся за вами.\n\n' +
    'Текст хранится в файле на этом компьютере. Наружу, и только если вы не выключили проверку, уходит запрос о новой версии.\n\n' +
    '«ОК» значит, что вы это прочитали.',
};

const dictionaries = { en, ru };

export type MessageKey = keyof typeof en;

export function formatMessage(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
}

function detectLanguage(): Language {
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export { detectLanguage };

interface I18nValue {
  language: Language;
  t: (key: MessageKey) => string;
}

const I18nContext = createContext<I18nValue>({
  language: 'en',
  t: (key) => en[key],
});

export function I18nProvider({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  const table = dictionaries[language];
  const value: I18nValue = {
    language,
    t: (key) => table[key],
  };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
