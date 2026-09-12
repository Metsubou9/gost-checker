import type { ParsedDocument, Paragraph, Violation, Severity } from "../core/model";
import { hasVisibleText } from "../core/text";

/** Верхнеуровневые абзацы (не в таблицах), в порядке следования. */
export function topLevelParagraphs(doc: ParsedDocument): Paragraph[] {
  return doc.paragraphs.filter((p) => !p.inTable);
}

/** Индексабельный список с позициями для сообщений. */
export function paragraphNumber(doc: ParsedDocument, p: Paragraph): number {
  const top = doc.paragraphs.filter((q) => !q.inTable);
  return top.indexOf(p) + 1;
}

/** Строку-локацию для нарушения. */
export function loc(doc: ParsedDocument, p: Paragraph): string {
  const n = paragraphNumber(doc, topLevelParagraphs(doc)[paragraphNumber(doc, p) - 1] ?? p);
  return `абзац ${n}`;
}

/** Простейший счётчик нарушений одного вида. */
export function violation(
  ruleId: string,
  severity: Severity,
  message: string,
  gostClause: string,
  location: string,
  excerpt: string | null,
  suggestion: string | null,
): Violation {
  return { ruleId, severity, message, gostClause, location, excerpt, suggestion };
}

/** Обрезать текст для показа в отчёте. */
export function excerpt(text: string, maxLen = 80): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length <= maxLen ? t : `${t.slice(0, maxLen - 1)}…`;
}

/** Видимый текст? (переэкспорт для правил) */
export { hasVisibleText };

/** Достать число из конфига. */
export function num(cfg: Record<string, unknown>, key: string, fallback: number): number {
  const v = cfg[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** Достать строку из конфига. */
export function str(cfg: Record<string, unknown>, key: string, fallback: string): string {
  const v = cfg[key];
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

/** Достать булево из конфига. */
export function bool(cfg: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const v = cfg[key];
  return typeof v === "boolean" ? v : fallback;
}

/** Совпадение имени шрифта без учёта регистра/пробелов/дефисов. */
export function fontMatches(actual: string | null, expected: string): boolean {
  if (!actual) return true; // унаследован — не виним
  const norm = (s: string) => s.toLowerCase().replace(/[\s\-_]/g, "");
  return norm(actual) === norm(expected);
}

/** Найти заголовок «Содержание» */
export function findTocHeading(doc: ParsedDocument): Paragraph | null {
  return topLevelParagraphs(doc).find((p) => p.structuralKind === "tocHeading") ?? null;
}

/** Найти заголовок списка литературы */
export function findReferencesHeading(doc: ParsedDocument): Paragraph | null {
  return topLevelParagraphs(doc).find((p) => p.structuralKind === "referencesHeading") !== undefined
    ? topLevelParagraphs(doc).find((p) => p.structuralKind === "referencesHeading")!
    : null;
}

/** Группировать нарушения по severity для сводки. */
export function countBySeverity(violations: Violation[]): Record<Severity, number> {
  const acc: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const v of violations) acc[v.severity]++;
  return acc;
}
