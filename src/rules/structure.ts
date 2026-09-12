import type { ParsedDocument, Paragraph, Rule, Violation } from "../core/model";
import { hasVisibleText, normalizeWhitespace } from "../core/text";
import { excerpt, num, topLevelParagraphs, violation } from "./helpers";

function loc(p: Paragraph): string {
  return `абзац «${excerpt(p.text, 40) ?? "…"}»`;
}

const headings = (doc: ParsedDocument): Paragraph[] =>
  topLevelParagraphs(doc).filter((p) => p.structuralKind === "heading");

/** Заголовок начинается с прописной буквы (первая буква — верхний регистр). */
function startsWithCapital(t: string): boolean {
  const first = t.replace(/^[«"'\s\d.]+/, "").charAt(0);
  return first ? first === first.toUpperCase() : true;
}

function checkHeadingCase(doc: ParsedDocument, _cfg: Record<string, unknown>): Violation[] {
  const out: Violation[] = [];
  for (const p of headings(doc)) {
    const t = normalizeWhitespace(p.text);
    if (!t) continue;
    if (!startsWithCapital(t)) {
      out.push(
        violation(
          "heading-case",
          "error",
          "Заголовок начинается со строчной буквы",
          "ГОСТ 2.105-95, п. 4.1.9 (с прописной буквы)",
          loc(p),
          excerpt(t),
          "Начните заголовок с прописной буквы.",
        ),
      );
    }
  }
  return out;
}

function checkHeadingTrailingDot(doc: ParsedDocument, _cfg: Record<string, unknown>): Violation[] {
  const out: Violation[] = [];
  for (const p of headings(doc)) {
    const t = normalizeWhitespace(p.text);
    if (!t) continue;
    if (t.endsWith(".")) {
      out.push(
        violation(
          "heading-trailing-dot",
          "error",
          "Точка в конце заголовка",
          "ГОСТ 2.105-95, п. 4.1.9 (без точки в конце)",
          loc(p),
          excerpt(t),
          "Уберите точку в конце заголовка.",
        ),
      );
    }
  }
  return out;
}

function checkHeadingUnderline(doc: ParsedDocument, _cfg: Record<string, unknown>): Violation[] {
  const out: Violation[] = [];
  for (const p of headings(doc)) {
    if (p.runs.some((r) => r.formatting.underline === true)) {
      out.push(
        violation(
          "heading-underline",
          "error",
          "Заголовок подчёркнут",
          "ГОСТ 2.105-95, п. 4.1.9 (не подчёркивая)",
          loc(p),
          excerpt(p.text),
          "Уберите подчёркивание заголовка.",
        ),
      );
    }
  }
  return out;
}

function checkHeadingHyphens(doc: ParsedDocument, _cfg: Record<string, unknown>): Violation[] {
  const out: Violation[] = [];
  for (const p of headings(doc)) {
    const t = normalizeWhitespace(p.text);
    // Явные дефис-переносы вида «инфор-мация»
    if (/[а-яёa-z]-[а-яёa-z]/.test(t) && /-\n/.test(p.text)) {
      out.push(
        violation(
          "heading-hyphens",
          "warning",
          "Возможен перенос слова в заголовке",
          "ГОСТ 2.105-95, п. 4.1.9 (переносы слов не допускаются)",
          loc(p),
          excerpt(t),
          "Уберите переносы в заголовке (запрет автоматического переноса).",
        ),
      );
    }
  }
  return out;
}

function checkHeadingNumbering(doc: ParsedDocument, _cfg: Record<string, unknown>): Violation[] {
  const out: Violation[] = [];
  let expectedSection = 0;
  let lastLevel1 = 0;
  let lastLevel2 = 0;
  let warned = false;
  for (const p of headings(doc)) {
    const t = normalizeWhitespace(p.text);
    const m = t.match(/^(\d+(?:\.\d+)*)\s/);
    if (!m) continue;
    const parts = m[1].split(".").map(Number);
    const level = parts.length;
    if (level === 1) {
      if (parts[0] !== lastLevel1 + 1 && !warned) {
        out.push(
          violation(
            "heading-numbering",
            "error",
            `Разделы нумеруются не по порядку: ожидается ${lastLevel1 + 1}, найден ${parts[0]}`,
            "ГОСТ 2.105-95, п. 4.1.2",
            loc(p),
            excerpt(t),
            "Нумеруйте разделы арабскими цифрами последовательно.",
          ),
        );
        warned = true;
      }
      lastLevel1 = parts[0];
      lastLevel2 = 0;
    } else if (level === 2) {
      if (parts[0] !== lastLevel1 || parts[1] !== lastLevel2 + 1) {
        out.push(
          violation(
            "heading-numbering",
            "error",
            `Подраздел ${m[1]} не согласуется с нумерацией (раздел ${lastLevel1}, предыдущий подраздел ${lastLevel2})`,
            "ГОСТ 2.105-95, п. 4.1.2–4.1.3",
            loc(p),
            excerpt(t),
            "Номер подраздела = номер раздела + порядковый номер подраздела.",
          ),
        );
      }
      lastLevel2 = parts[1];
    }
    expectedSection = parts[0];
  }
  void expectedSection;
  return out;
}

function checkHeadingSpacing(doc: ParsedDocument, cfg: Record<string, unknown>): Violation[] {
  const out: Violation[] = [];
  const maxBeforeHeadingPt = num(cfg, "maxBeforePt", 48);
  const maxAfterHeadingPt = num(cfg, "maxAfterPt", 48);
  const top = topLevelParagraphs(doc);
  for (let i = 0; i < top.length; i++) {
    const p = top[i];
    if (p.structuralKind !== "heading") continue;
    const next = top[i + 1];
    const after = next ? next.formatting.spacingBeforePt : null;
    // ГОСТ: между заголовком и текстом 3–4 интервала пишущей машинки;
    // на практике — увеличенный интервал до/после заголовка
    if (p.formatting.spacingBeforePt !== null && p.formatting.spacingBeforePt > maxBeforeHeadingPt) {
      out.push(
        violation(
          "heading-spacing",
          "info",
          `Отступ перед заголовком ${Math.round(p.formatting.spacingBeforePt)} пт — проверьте, что это 2–4 интервала`,
          "ГОСТ 2.105-95, п. 4.1.9",
          loc(p),
          excerpt(p.text, 40),
          "Расстояние между заголовком и текстом — 3–4 интервала, между заголовками раздела и подраздела — 2 интервала.",
        ),
      );
    }
    if (after !== null && after > maxAfterHeadingPt) {
      out.push(
        violation(
          "heading-spacing",
          "info",
          `Отступ после заголовка ${Math.round(after)} пт — проверьте требование 3–4 интервалов`,
          "ГОСТ 2.105-95, п. 4.1.9",
          loc(next!),
          excerpt(next!.text, 40),
          "Расстояние между заголовком и текстом — 3–4 интервала.",
        ),
      );
    }
  }
  return out;
}

function checkSectionNewPage(doc: ParsedDocument, cfg: Record<string, unknown>): Violation[] {
  const out: Violation[] = [];
  const require = cfg["require"] !== false;
  if (!require) return out;
  const top = topLevelParagraphs(doc);
  for (let i = 0; i < top.length; i++) {
    const p = top[i];
    if (!(p.structuralKind === "heading" && p.headingLevel === 1)) continue;
    if (i === 0) continue; // первый раздел может начинаться сразу
    const prev = top[i - 1];
    const hasPageBreak =
      prev.text.includes("\f") ||
      (prev.formatting.spacingBeforePt !== null && prev.formatting.spacingBeforePt >= 300);
    if (!hasPageBreak) {
      out.push(
        violation(
          "section-new-page",
          "info",
          "Раздел, возможно, не начинается с нового листа",
          "ГОСТ 2.105-95, п. 4.1.10 (рекомендуется)",
          loc(p),
          excerpt(p.text, 40),
          "Начинайте каждый раздел с нового листа (разрыв страницы).",
        ),
      );
    }
  }
  return out;
}

function checkToc(doc: ParsedDocument, cfg: Record<string, unknown>): Violation[] {
  const out: Violation[] = [];
  const minParagraphs = num(cfg, "minParagraphs", 60);
  const top = topLevelParagraphs(doc);
  const textParagraphs = top.filter((p) => hasVisibleText(p.text));
  const hasToc = top.some((p) => p.structuralKind === "tocHeading");
  if (textParagraphs.length >= minParagraphs && !hasToc) {
    out.push(
      violation(
        "toc-present",
        "warning",
        `Документ большой (${textParagraphs.length} абзацев), но раздел «Содержание» не найден`,
        "ГОСТ 2.105-95, п. 4.1.11",
        "весь документ",
        null,
        "Добавьте содержание с номерами и наименованиями разделов.",
      ),
    );
  }
  return out;
}

export const headingCaseRule: Rule = {
  id: "heading-case",
  title: "Заголовки: прописная буква",
  gostClause: "ГОСТ 2.105-95, п. 4.1.9",
  severity: "error",
  description: "Заголовки печатаются с прописной буквы.",
  defaultConfig: {},
  check: checkHeadingCase,
};

export const headingTrailingDotRule: Rule = {
  id: "heading-trailing-dot",
  title: "Заголовки: без точки в конце",
  gostClause: "ГОСТ 2.105-95, п. 4.1.9",
  severity: "error",
  description: "В конце заголовка точка не ставится.",
  defaultConfig: {},
  check: checkHeadingTrailingDot,
};

export const headingUnderlineRule: Rule = {
  id: "heading-underline",
  title: "Заголовки: без подчёркивания",
  gostClause: "ГОСТ 2.105-95, п. 4.1.9",
  severity: "error",
  description: "Заголовки не подчёркиваются.",
  defaultConfig: {},
  check: checkHeadingUnderline,
};

export const headingHyphensRule: Rule = {
  id: "heading-hyphens",
  title: "Заголовки: без переносов",
  gostClause: "ГОСТ 2.105-95, п. 4.1.9",
  severity: "warning",
  description: "Переносы слов в заголовках не допускаются.",
  defaultConfig: {},
  check: checkHeadingHyphens,
};

export const headingNumberingRule: Rule = {
  id: "heading-numbering",
  title: "Нумерация разделов и подразделов",
  gostClause: "ГОСТ 2.105-95, п. 4.1.2–4.1.3",
  severity: "error",
  description:
    "Разделы нумеруются арабскими цифрами в пределах документа, подразделы — в пределах раздела; точка после номера не ставится.",
  defaultConfig: {},
  check: checkHeadingNumbering,
};

export const headingSpacingRule: Rule = {
  id: "heading-spacing",
  title: "Расстояние между заголовками и текстом",
  gostClause: "ГОСТ 2.105-95, п. 4.1.9",
  severity: "info",
  description: "Между заголовком и текстом — 3–4 интервала; между заголовками раздела и подраздела — 2 интервала.",
  defaultConfig: { maxBeforePt: 48, maxAfterPt: 48 },
  check: checkHeadingSpacing,
};

export const sectionNewPageRule: Rule = {
  id: "section-new-page",
  title: "Раздел с нового листа",
  gostClause: "ГОСТ 2.105-95, п. 4.1.10",
  severity: "info",
  description: "Каждый раздел рекомендуется начинать с нового листа.",
  defaultConfig: { require: true },
  check: checkSectionNewPage,
};

export const tocPresentRule: Rule = {
  id: "toc-present",
  title: "Наличие содержания",
  gostClause: "ГОСТ 2.105-95, п. 4.1.11",
  severity: "warning",
  description: "В документах большого объёма приводится содержание.",
  defaultConfig: { minParagraphs: 60 },
  check: checkToc,
};
