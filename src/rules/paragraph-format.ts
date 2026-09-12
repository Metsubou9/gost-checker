import type { ParsedDocument, Paragraph, Rule, Violation } from "../core/model";
import { hasVisibleText } from "../core/text";
import { excerpt, num, str, violation } from "./helpers";
import { bodyParagraphs } from "./font";

function loc(p: Paragraph): string {
  return `абзац «${excerpt(p.text, 40) ?? "…"}»`;
}

function fmtMm(v: number): string {
  return String(Math.round(v * 10) / 10);
}

function checkLineSpacing(doc: ParsedDocument, cfg: Record<string, unknown>): Violation[] {
  const out: Violation[] = [];
  const expected = num(cfg, "multiple", 1.5);
  const tol = num(cfg, "tolerance", 0.02);
  for (const p of bodyParagraphs(doc)) {
    const ls = p.formatting.lineSpacing;
    const value = ls && ls.kind === "multiple" ? ls.value : null;
    const ok = value !== null && Math.abs(value - expected) <= tol;
    if (!ok) {
      const actual =
        ls === null
          ? "не задан явно"
          : ls.kind === "multiple"
            ? `${Math.round(ls.value * 100) / 100}`
            : `${Math.round(ls.pt * 10) / 10} пт (${ls.kind === "exact" ? "точно" : "минимум"})`;
      out.push(
        violation(
          "line-spacing",
          "error",
          `Межстрочный интервал ${actual} вместо полуторного`,
          "ГОСТ 2.105-95, п. 3.6 (типовая практика ЕСКД; настраивается)",
          loc(p),
          excerpt(p.text, 40),
          "Установите межстрочный интервал «1,5 строки».",
        ),
      );
    }
  }
  return out;
}

function checkIndent(doc: ParsedDocument, cfg: Record<string, unknown>): Violation[] {
  const out: Violation[] = [];
  const min = num(cfg, "minMm", 15);
  const max = num(cfg, "maxMm", 17);
  for (const p of bodyParagraphs(doc)) {
    const ind = p.formatting.firstLineIndentMm;
    // Отступ, заданный стилем, может отсутствовать — тогда не виним
    if (ind === null) continue;
    if (ind < min || ind > max) {
      out.push(
        violation(
          "paragraph-indent",
          "error",
          `Абзацный отступ ${fmtMm(ind)} мм вне диапазона ${min}–${max} мм`,
          "ГОСТ 2.105-95, п. 3.6 (отступ 15–17 мм)",
          loc(p),
          excerpt(p.text, 40),
          `Установите абзацный отступ ${min}–${max} мм (обычно 1,25 см).`,
        ),
      );
    }
  }
  return out;
}

function checkAlignment(doc: ParsedDocument, cfg: Record<string, unknown>): Violation[] {
  const out: Violation[] = [];
  const expected = str(cfg, "alignment", "justify") as "left" | "justify" | "center" | "right";
  const includeHeadings = cfg["includeHeadings"] === true;
  for (const p of bodyParagraphs(doc)) {
    if (p.structuralKind === "heading" && !includeHeadings) continue;
    if (p.formatting.alignment !== expected) {
      out.push(
        violation(
          "text-alignment",
          "error",
          `Выравнивание «${alignName(p.formatting.alignment)}» вместо «${alignName(expected)}»`,
          "ГОСТ 2.105-95, п. 3.6 (типовая практика; настраивается)",
          loc(p),
          excerpt(p.text, 40),
          "Установите выравнивание по ширине.",
        ),
      );
    }
  }
  return out;
}

function alignName(a: string): string {
  switch (a) {
    case "left": return "по левому краю";
    case "right": return "по правому краю";
    case "center": return "по центру";
    case "justify": return "по ширине";
    default: return "не задано";
  }
}

function checkColor(doc: ParsedDocument, cfg: Record<string, unknown>): Violation[] {
  const out: Violation[] = [];
  const allowed = str(cfg, "allowedColors", "000000,auto")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const allowInherited = cfg["allowInherited"] !== false;
  for (const p of bodyParagraphs(doc)) {
    for (const r of p.runs) {
      if (!hasVisibleText(r.text)) continue;
      const c = r.formatting.color;
      if (c === null && allowInherited) continue;
      const norm = (c ?? "").replace("#", "").toLowerCase();
      if (c !== null && !allowed.includes(norm) && norm !== "auto") {
        out.push(
          violation(
            "text-color",
            "warning",
            `Цвет текста #${norm} вместо чёрного`,
            "ГОСТ 2.105-95, п. 3.3 (чёрный цвет)",
            loc(p),
            excerpt(r.text, 40),
            "Установите автоматический (чёрный) цвет шрифта.",
          ),
        );
        break;
      }
    }
  }
  return out;
}

export const lineSpacingRule: Rule = {
  id: "line-spacing",
  title: "Межстрочный интервал",
  gostClause: "ГОСТ 2.105-95, п. 3.6 (типовая практика)",
  severity: "error",
  description: "Межстрочный интервал основного текста — полуторный (настраивается).",
  defaultConfig: { multiple: 1.5, tolerance: 0.02 },
  check: checkLineSpacing,
};

export const indentRule: Rule = {
  id: "paragraph-indent",
  title: "Абзацный отступ",
  gostClause: "ГОСТ 2.105-95, п. 3.6",
  severity: "error",
  description: "Первая строка абзаца с отступом 15–17 мм (настраивается).",
  defaultConfig: { minMm: 15, maxMm: 17 },
  check: checkIndent,
};

export const alignmentRule: Rule = {
  id: "text-alignment",
  title: "Выравнивание текста",
  gostClause: "ГОСТ 2.105-95, п. 3.6 (типовая практика)",
  severity: "error",
  description: "Текст выравнивается по ширине (настраивается).",
  defaultConfig: { alignment: "justify", includeHeadings: false },
  check: checkAlignment,
};

export const colorRule: Rule = {
  id: "text-color",
  title: "Цвет текста",
  gostClause: "ГОСТ 2.105-95, п. 3.3",
  severity: "warning",
  description: "Цвет текста — чёрный.",
  defaultConfig: { allowedColors: "000000,auto" },
  check: checkColor,
};
