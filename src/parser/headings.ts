import type { ParsedDocument, Paragraph, StructuralKind } from "../core/model";
import { hasVisibleText, normalizeWhitespace } from "../core/text";

/** Шаблоны для распознавания структурных элементов. */
export const REFS_RE =
  /^(список использованных источников|список литературы|библиографический список|библиография|references?)\s*$/i;
export const TOC_RE = /^(содержание|оглавление|table of contents)\s*$/i;
/** «1», «1.1», «1.1.1» в начале абзаца. */
export const NUM_RE = /^(\d+(?:\.\d+){0,4})\s+(.+)$/;

/** Число вида «Таблица 12.3» / «Рисунок В.1» в начале подписи. */
export const CAPTION_NUM_RE = /^(\d+(?:\.\d+)*|[А-ЯЁ])\.(\d+)$/;

function normalize(text: string): string {
  return normalizeWhitespace(text);
}

/**
 * Классификация абзацев: заголовки, подписи к таблицам/рисункам,
 * заголовок и записи списка литературы. Работает на тексте и
 * прямом форматировании, поэтому не зависит от наличия стилей.
 */
export function classifyParagraphs(doc: ParsedDocument): void {
  const top = doc.paragraphs.filter((p) => !p.inTable);
  let inReferences = false;

  for (const p of top) {
    // Уровень из стиля/outlineLvl (заполнен парсером) — приоритетный сигнал:
    // заголовок остаётся заголовком, даже если текст не соответствует эвристике
    // (например, точка в конце — её как раз и ищет правило heading-trailing-dot).
    const styleHeadingLevel = p.headingLevel;
    p.structuralKind = "normal";
    p.headingLevel = null;
    const t = normalize(p.text);
    if (!hasVisibleText(t)) continue;

    if (styleHeadingLevel !== null) {
      p.structuralKind = "heading";
      p.headingLevel = styleHeadingLevel;
      continue;
    }

    // Заголовок списка литературы переводит режим до конца документа
    if (REFS_RE.test(t)) {
      p.structuralKind = "referencesHeading";
      inReferences = true;
      continue;
    }
    if (TOC_RE.test(t)) {
      p.structuralKind = "tocHeading";
      continue;
    }

    if (inReferences && isReferenceEntry(t)) {
      p.structuralKind = "referenceEntry";
      continue;
    }

    // Подписи: «Таблица 12.3 — Название» / «Рисунок В.1 — Название»
    if (/^(таблица|рисунок)\s+/i.test(t)) {
      const kind: StructuralKind = /^таблица/i.test(t) ? "tableCaption" : "figureCaption";
      const m = t.match(/^(?:таблица|рисунок)\s+([^\s—–-]+)/i);
      const numToken = m?.[1] ?? "";
      if (isCaptionNumber(numToken)) {
        // Заголовки с центрированием не спутать: подпись таблицы обычно слева
        if (kind === "figureCaption" || p.formatting.alignment !== "center") {
          p.structuralKind = kind;
          continue;
        }
      }
    }

    const h = detectHeading(t, p);
    if (h) {
      p.structuralKind = "heading";
      p.headingLevel = h.level;
      continue;
    }
  }
}

/** Похоже ли на номер подписи: «1», «2.1», «А.1». */
function isCaptionNumber(token: string): boolean {
  return /^\d+(\.\d+)*$/.test(token) || /^[А-ЯЁ]\.\d+$/.test(token);
}

/** Похоже ли на запись списка литературы: «1. Автор А.А. ...» или «1 Автор ...». */
function isReferenceEntry(t: string): boolean {
  return /^(\d{1,3})([.)])?\s+\S/.test(t);
}

export interface DetectedHeading {
  level: number;
  matchedText: string;
}

/**
 * Является ли абзац заголовком (по нумерации или содержанию).
 * Возвращает уровень (1 = раздел) или null.
 */
export function detectHeading(t: string, p: Paragraph): DetectedHeading | null {
  const m = t.match(NUM_RE);
  if (m) {
    const num = m[1];
    const level = num.split(".").length;
    // Слишком длинный «номер» — скорее список литературы или дата
    if (level <= 4) {
      const rest = m[2];
      // «2019 году» — не заголовок; заголовок начинается с буквы
      if (/^[«"А-ЯЁA-Z]/.test(rest) || /^[а-яёa-z]/.test(rest)) {
        // Пустой остаток или очень длинный абзац с точкой в конце — не заголовок
        if (rest.length <= 150 && !/[.!?]$/.test(rest)) {
          return { level, matchedText: num };
        }
      }
    }
  }
  // Ненумерованный крупный заголовок: короткий, не заканчивается точкой,
  // не начинается с маркера перечисления
  if (p.structuralKind === "normal" && t.length <= 100 && !/[.!?]$/.test(t)) {
    const startsLikeList = /^[-–—•*]/.test(t) || /^([а-яёa-z]\)|\d{1,2}\))\s/.test(t);
    const isSentence = /[,:;]/.test(t) && t.split(" ").length > 4;
    if (!startsLikeList && !isSentence) {
      // Требуем, чтобы абзац был заметно оформлен или короток
      const short = t.split(" ").length <= 8;
      if (short) {
        return { level: 1, matchedText: "" };
      }
    }
  }
  return null;
}
