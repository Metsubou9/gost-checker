import type { ParsedDocument, Paragraph, Rule, Violation } from "../core/model";
import { hasVisibleText } from "../core/text";
import { excerpt, fontMatches, num, str, topLevelParagraphs, violation } from "./helpers";

function loc(p: Paragraph): string {
  return `абзац «${excerpt(p.text, 40) ?? "…"}»`;
}

/** Абзацы основного текста (без заголовков, подписей и списка литературы — у них свои правила). */
export function bodyParagraphs(doc: ParsedDocument): Paragraph[] {
  return topLevelParagraphs(doc).filter((p) => {
    if (!hasVisibleText(p.text)) return false;
    const k = p.structuralKind;
    return (
      k !== "heading" &&
      k !== "tableCaption" &&
      k !== "figureCaption" &&
      k !== "referenceEntry" &&
      k !== "referencesHeading" &&
      k !== "tocHeading"
    );
  });
}

function checkFontFamily(doc: ParsedDocument, cfg: Record<string, unknown>): Violation[] {
  const out: Violation[] = [];
  const expected = str(cfg, "font", "Times New Roman");
  const seen = new Set<string>();
  for (const p of bodyParagraphs(doc)) {
    for (const r of p.runs) {
      if (!hasVisibleText(r.text)) continue;
      if (!fontMatches(r.formatting.fontFamily, expected) && !seen.has(p.id)) {
        seen.add(p.id);
        out.push(
          violation(
            "font-family",
            "error",
            `Шрифт «${r.formatting.fontFamily ?? "унаследован"}» вместо «${expected}»`,
            "ГОСТ 2.105-95, п. 3.3 (ГОСТ 2.004)",
            loc(p),
            excerpt(r.text),
            `Установите шрифт ${expected}.`,
          ),
        );
        break;
      }
    }
  }
  return out;
}

function checkFontSize(doc: ParsedDocument, cfg: Record<string, unknown>): Violation[] {
  const out: Violation[] = [];
  const expected = num(cfg, "sizePt", 14);
  const seen = new Set<string>();
  for (const p of bodyParagraphs(doc)) {
    for (const r of p.runs) {
      if (!hasVisibleText(r.text)) continue;
      const size = r.formatting.fontSizePt;
      if (size === null || size === expected) continue;
      if (!seen.has(p.id)) {
        seen.add(p.id);
        out.push(
          violation(
            "font-size",
            "error",
            `Размер шрифта ${Math.round(size * 10) / 10} пт вместо ${expected} пт`,
            "ГОСТ 2.105-95, п. 3.3",
            loc(p),
            excerpt(r.text),
            `Установите кегль ${expected} пт.`,
          ),
        );
        break;
      }
    }
  }
  return out;
}

export const fontFamilyRule: Rule = {
  id: "font-family",
  title: "Гарнитура шрифта",
  gostClause: "ГОСТ 2.105-95, п. 3.3 (ГОСТ 2.004)",
  severity: "error",
  description: "Текст набирается шрифтом Times New Roman (настраивается).",
  defaultConfig: { font: "Times New Roman" },
  check: checkFontFamily,
};

export const fontSizeRule: Rule = {
  id: "font-size",
  title: "Кегль шрифта",
  gostClause: "ГОСТ 2.105-95, п. 3.3",
  severity: "error",
  description: "Основной текст — 14 пт (настраивается).",
  defaultConfig: { sizePt: 14 },
  check: checkFontSize,
};
