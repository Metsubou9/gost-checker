/** Хелперы для работы с текстом (кавычки, неразрывные пробелы и т.п.). */

/** Видимые символы (не пробельные). */
export function hasVisibleText(text: string): boolean {
  return text.replace(/\s/g, "").length > 0;
}

/** Убирает неразрывные пробелы и прочие спецпробелы для анализа текста. */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/[\u00A0\u2007\u202F\u2009]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Заменяет ASCII-кавычки на «ёлочки» для вывода в сообщениях. */
export function prettyQuotes(text: string): string {
  return text.replace(/"/g, "«").replace(/'/g, "’");
}
