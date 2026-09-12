/**
 * Базовые типы документа, полученного после разбора .docx.
 * Модель формата-независимая: парсер любого формата (docx, xlsx, odt...)
 * должен заполнять именно эти структуры.
 */

export type Alignment = "left" | "right" | "center" | "justify" | "unknown";

export interface RunFormatting {
  /** Имя шрифта (как в документе, например "Times New Roman") */
  fontFamily: string | null;
  /** Размер шрифта в пунктах */
  fontSizePt: number | null;
  bold: boolean | null;
  italic: boolean | null;
  underline: boolean | null;
  /** Цвет в hex (#RRGGBB) или null, если унаследован/авто */
  color: string | null;
}

export interface Run {
  text: string;
  formatting: RunFormatting;
}

export interface Paragraph {
  /** Уникальный в пределах документа id */
  id: string;
  text: string;
  runs: Run[];
  /** Индекс раздела, к которому относится абзац */
  sectionIndex: number;
  /** Индекс «верхнего» абзаца вне таблицы, либо null */
  parentParagraphId: string | null;
  /** Внутри ячейки таблицы */
  inTable: boolean;
  formatting: ParagraphFormatting;
  numbering: ParagraphNumbering | null;
  /** Тип структурного элемента (эвристика, см. headings.ts) */
  structuralKind: StructuralKind;
  /** Номер структурного уровня, если известен (заголовок/лист) */
  headingLevel: number | null;
  /** Номер страницы из верхнего/нижнего колонтитула (заполняется при возможности) */
  approximatePage: number | null;
}

export interface ParagraphFormatting {
  alignment: Alignment;
  /** Абзацный отступ первой строки, мм */
  firstLineIndentMm: number | null;
  /** Левый отступ абзаца, мм */
  leftIndentMm: number | null;
  /** Межстрочный интервал: множитель (1.5) или пункты */
  lineSpacing: LineSpacing | null;
  /** Расстояние до абзаца, пт */
  spacingBeforePt: number | null;
  /** Расстояние после абзаца, пт */
  spacingAfterPt: number | null;
}

export type LineSpacing =
  | { kind: "multiple"; value: number }
  | { kind: "exact"; pt: number }
  | { kind: "atLeast"; pt: number };

export interface ParagraphNumbering {
  /** Уровень нумерации (0 = первый уровень) */
  level: number;
  /** Текстовое представление номера, если удалось вычислить (например "1", "2.1") */
  textRepresentation: string | null;
  isOrdered: boolean;
}

export interface Table {
  id: string;
  /** Количество строк */
  rows: number;
  columns: number;
  /** Индекс раздела, к которому относится таблица */
  sectionIndex: number;
  /** Индекс абзаца, идущего непосредственно перед таблицей (подпись) */
  captionParagraphId: string | null;
}

export interface Figure {
  id: string;
  /** Ширина изображения, мм */
  widthMm: number | null;
  heightMm: number | null;
  sectionIndex: number;
  /** Абзац с изображением */
  paragraphId: string;
}

export interface PageSetup {
  /** Все размеры в мм */
  pageWidthMm: number;
  pageHeightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  /** Наличие номеров страниц в нижнем колонтитуле */
  pageNumberInFooter: boolean;
  /** Наличие номеров страниц в верхнем колонтитуле */
  pageNumberInHeader: boolean;
}

export interface DocSection {
  id: string;
  pageSetup: PageSetup;
}

/** Верхнеуровневый документ */
export interface ParsedDocument {
  sections: DocSection[];
  paragraphs: Paragraph[];
  tables: Table[];
  figures: Figure[];
  /** Имя исходного файла */
  fileName: string;
  /** Неоткрытые/неподдерживаемые особенности документа (для отладки) */
  warnings: string[];
}

export type Severity = "error" | "warning" | "info";

export type StructuralKind =
  | "normal"
  | "heading"
  | "tableCaption"
  | "figureCaption"
  | "referencesHeading"
  | "tocHeading"
  | "referenceEntry";

/** Нарушение конкретного правила */
export interface Violation {
  /** Идентификатор правила, например "page-margins" */
  ruleId: string;
  /** Уровень важности */
  severity: Severity;
  /** Человеческое описание */
  message: string;
  /** Пункт ГОСТ (например "ГОСТ 2.105-95, п. 3.6") */
  gostClause: string;
  /** Где в документе (номер страницы/абзаца, текст) */
  location: string;
  /** Фрагмент текста (обрезанный) */
  excerpt: string | null;
  /** Как исправить */
  suggestion: string | null;
}

/** Конфигурация правила — значения могут переопределяться пользователем */
export type RuleConfig = Record<string, number | string | boolean>;

export interface Rule {
  id: string;
  /** Заголовок правила для отчёта */
  title: string;
  /** Пункт ГОСТ */
  gostClause: string;
  severity: Severity;
  /** Описание правила (что проверяет) */
  description: string;
  /** Значения по умолчанию (шрифт, размеры и т.п.), переопределяемые пользователем */
  defaultConfig: RuleConfig;
  /** Сама проверка */
  check: (doc: ParsedDocument, config: RuleConfig) => Violation[];
}

export interface GostProfile {
  id: string;
  name: string;
  description: string;
  rules: Rule[];
}
