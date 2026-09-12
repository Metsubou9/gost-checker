import type { ParsedDocument, Paragraph, Rule, Violation } from "../core/model";
import { normalizeWhitespace } from "../core/text";
import { excerpt, findReferencesHeading, topLevelParagraphs, violation } from "./helpers";

function loc(p: Paragraph): string {
  return `абзац «${excerpt(p.text, 40) ?? "…"}»`;
}

function referenceEntries(doc: ParsedDocument): Paragraph[] {
  const head = findReferencesHeading(doc);
  if (!head) return [];
  const top = topLevelParagraphs(doc);
  const idx = top.indexOf(head);
  return top.slice(idx + 1).filter((p) => p.structuralKind === "referenceEntry");
}

function checkReferencesPresence(doc: ParsedDocument, cfg: Record<string, unknown>): Violation[] {
  const out: Violation[] = [];
  const minEntries = typeof cfg["minEntries"] === "number" ? cfg["minEntries"] : 0;
  const required = cfg["required"] !== false;
  const head = findReferencesHeading(doc);
  if (!head) {
    if (required) {
      out.push(
        violation(
          "references-present",
          "warning",
          "Список литературы («Список использованных источников») не найден",
          "ГОСТ 2.105-95, п. 4.1.12 (по ГОСТ 7.32)",
          "весь документ",
          null,
          "Добавьте в конце документа список использованных источников.",
        ),
      );
    }
    return out;
  }
  const entries = referenceEntries(doc);
  if (entries.length < minEntries) {
    out.push(
      violation(
        "references-present",
        "warning",
        `В списке литературы ${entries.length} записей, ожидается не менее ${minEntries}`,
        "ГОСТ 2.105-95, п. 4.1.12",
        loc(head),
        excerpt(head.text),
        "Дополните список источников.",
      ),
    );
  }
  return out;
}

function checkEntryNumbering(doc: ParsedDocument, _cfg: Record<string, unknown>): Violation[] {
  const out: Violation[] = [];
  const entries = referenceEntries(doc);
  let expected = 1;
  let broken = false;
  for (const p of entries) {
    const t = normalizeWhitespace(p.text);
    const m = t.match(/^(\d{1,3})([.)])?\s/);
    if (!m) {
      out.push(
        violation(
          "references-numbering",
          "warning",
          "Запись списка литературы без номера",
          "ГОСТ 7.32 (нумерованный список)",
          loc(p),
          excerpt(t),
          "Пронумеруйте записи списка (1, 2, 3, …).",
        ),
      );
      continue;
    }
    if (Number(m[1]) !== expected && !broken) {
      out.push(
        violation(
          "references-numbering",
          "error",
          `Нарушена последовательность нумерации источников: ожидалось ${expected}, найдено ${m[1]}`,
          "ГОСТ 7.32 (порядок нумерации)",
          loc(p),
          excerpt(t),
          "Исправьте нумерацию записей.",
        ),
      );
      broken = true;
    }
    expected = Number(m[1]) + 1;
  }
  return out;
}

/** Кавычки-ёлочки для названий издательств и т.п. */
function checkEntryPatterns(doc: ParsedDocument, cfg: Record<string, unknown>): Violation[] {
  const out: Violation[] = [];
  const checkYear = cfg["checkYear"] !== false;
  const entries = referenceEntries(doc);
  const yearRe = /(?:^|[\s,.;(])(1[5-9]\d{2}|20\d{2})\s*(?:г\.|г\b|$|[,.)])/;
  for (const p of entries) {
    const t = normalizeWhitespace(p.text);
    if (checkYear && !yearRe.test(t)) {
      out.push(
        violation(
          "references-pattern",
          "info",
          "Не найден год издания в записи списка литературы",
          "ГОСТ 7.32 / ГОСТ 7.1 (библиографическое описание)",
          loc(p),
          excerpt(t),
          "Описание должно содержать год издания (например «… М.: Изд-во, 2020. – 123 с.»).",
        ),
      );
    }
    // Типографские кавычки: ASCII-кавычки в описании — suspect
    if (/["']/.test(t)) {
      out.push(
        violation(
          "references-pattern",
          "info",
          "В записи использованы ASCII-кавычки вместо «ёлочек»",
          "ГОСТ 7.32 (типографские кавычки)",
          loc(p),
          excerpt(t),
          "Замените \" на «…».",
        ),
      );
    }
  }
  return out;
}

export const referencesPresentRule: Rule = {
  id: "references-present",
  title: "Наличие списка литературы",
  gostClause: "ГОСТ 2.105-95, п. 4.1.12",
  severity: "warning",
  description: "В конце документа приводится список использованных источников (по ГОСТ 7.32).",
  defaultConfig: { required: true, minEntries: 0 },
  check: checkReferencesPresence,
};

export const referencesNumberingRule: Rule = {
  id: "references-numbering",
  title: "Нумерация источников",
  gostClause: "ГОСТ 2.105-95, п. 4.1.12 (ГОСТ 7.32)",
  severity: "error",
  description: "Записи списка нумеруются арабскими цифрами последовательно.",
  defaultConfig: {},
  check: checkEntryNumbering,
};

export const referencesPatternRule: Rule = {
  id: "references-pattern",
  title: "Оформление описаний источников",
  gostClause: "ГОСТ 7.32 / ГОСТ 7.1",
  severity: "info",
  description: "В описании присутствуют год издания, типографские кавычки и т.п.",
  defaultConfig: { checkYear: true },
  check: checkEntryPatterns,
};
