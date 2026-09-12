import type { Alignment, LineSpacing } from "../core/model";
import { eighthsToPt, halfPointsToPt, twipsToMm } from "../core/units";
import type { XmlElement } from "./xml";

/** Разрешение наследования стилей OOXML (docDefaults → basedOn-цепочка → прямое форматирование). */

export interface ResolvedRunFormat {
  fontFamily: string | null;
  fontSizePt: number | null;
  bold: boolean | null;
  italic: boolean | null;
  underline: boolean | null;
  color: string | null;
}

export interface ResolvedParagraphFormat {
  alignment: Alignment;
  firstLineIndentMm: number | null;
  leftIndentMm: number | null;
  lineSpacing: LineSpacing | null;
  spacingBeforePt: number | null;
  spacingAfterPt: number | null;
}

export interface StyleEntry {
  id: string;
  name: string | null;
  basedOn: string | null;
  type: string | null;
  run: ResolvedRunFormat;
  paragraph: ResolvedParagraphFormat;
  outlineLvl: number | null;
  /** Уровень заголовка, если стиль им является (Стиль "Заголовок 1" → 1) */
  headingLevel: number | null;
}

export interface DocDefaults {
  run: ResolvedRunFormat;
  paragraph: ResolvedParagraphFormat;
}

export interface StyleTable {
  defaults: DocDefaults;
  byId: Map<string, StyleEntry>;
  byName: Map<string, StyleEntry>;
}

function parseRunPr(rPr: XmlElement | undefined): ResolvedRunFormat {
  const empty: ResolvedRunFormat = {
    fontFamily: null,
    fontSizePt: null,
    bold: null,
    italic: null,
    underline: null,
    color: null,
  };
  if (!rPr) return empty;
  const rFonts = rPr.child("rFonts");
  const sz = rPr.child("sz")?.attrNum("val") ?? null;
  const colorVal = rPr.child("color")?.attr("val") ?? null;
  const fontFamily = rFonts
    ? (rFonts.attr("ascii") ?? rFonts.attr("hAnsi") ?? rFonts.attr("cs") ?? rFonts.attr("eastAsia") ?? null)
    : null;
  return {
    fontFamily,
    fontSizePt: sz !== null ? halfPointsToPt(sz) : null,
    bold: rPr.child("b") ? (rPr.child("b")!.attrNum("val") ?? 1) !== 0 : null,
    italic: rPr.child("i") ? (rPr.child("i")!.attrNum("val") ?? 1) !== 0 : null,
    underline: rPr.child("u") ? rPr.child("u")!.attr("val") !== "none" : null,
    color: colorVal && colorVal !== "auto" ? (colorVal.startsWith("#") ? colorVal : `#${colorVal}`) : null,
  };
}

function parsePPr(pPr: XmlElement | undefined): ResolvedParagraphFormat {
  const empty: ResolvedParagraphFormat = {
    alignment: "unknown",
    firstLineIndentMm: null,
    leftIndentMm: null,
    lineSpacing: null,
    spacingBeforePt: null,
    spacingAfterPt: null,
  };
  if (!pPr) return empty;
  const jc = pPr.child("jc")?.attr("val");
  const ind = pPr.child("ind");
  const spacing = pPr.child("spacing");
  let lineSpacing: LineSpacing | null = null;
  const line = spacing?.attrNum("line") ?? null;
  const lineRule = spacing?.attr("lineRule") ?? "auto";
  if (line !== null) {
    if (lineRule === "exact") lineSpacing = { kind: "exact", pt: line / 20 };
    else if (lineRule === "atLeast") lineSpacing = { kind: "atLeast", pt: line / 20 };
    else lineSpacing = { kind: "multiple", value: line / 240 };
  }
  return {
    alignment: parseJc(jc),
    firstLineIndentMm: ind?.attrNum("firstLine") !== null && ind?.attrNum("firstLine") !== undefined
      ? twipsToMm(ind!.attrNum("firstLine")!)
      : null,
    leftIndentMm: ind?.attrNum("left") !== null && ind?.attrNum("left") !== undefined
      ? twipsToMm(ind!.attrNum("left")!)
      : null,
    lineSpacing,
    spacingBeforePt: spacing?.attrNum("before") !== null && spacing?.attrNum("before") !== undefined
      ? eighthsToPt(spacing!.attrNum("before")!)
      : null,
    spacingAfterPt: spacing?.attrNum("after") !== null && spacing?.attrNum("after") !== undefined
      ? eighthsToPt(spacing!.attrNum("after")!)
      : null,
  };
}

function parseJc(jc: string | undefined): Alignment {
  switch (jc) {
    case "left":
    case "start":
      return "left";
    case "right":
    case "end":
      return "right";
    case "center":
      return "center";
    case "both":
    case "justify":
      return "justify";
    default:
      return "unknown";
  }
}

/** Разобрать styles.xml в таблицу стилей. */
export function parseStylesXml(stylesXml: string): StyleTable {
  const parser = new DOMParser();
  const doc = parser.parseFromString(stylesXml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("styles.xml: ошибка разбора XML");
  }
  const byId = new Map<string, StyleEntry>();
  const byName = new Map<string, StyleEntry>();

  const defaults: DocDefaults = {
    run: parseRunPr(undefined),
    paragraph: parsePPr(undefined),
  };

  const stylesEl = doc.documentElement;
  if (stylesEl && stylesEl.localName === "styles") {
    // docDefaults
    const docDefaults = stylesEl.querySelector("docDefaults") as Element | null;
    if (docDefaults) {
      const rPrDefault = docDefaults.querySelector("rPrDefault rPr") as Element | null;
      if (rPrDefault) {
        // Собираем значения напрямую из DOM-элементов
        const rFonts = rPrDefault.querySelector("rFonts");
        const sz = rPrDefault.querySelector("sz");
        const color = rPrDefault.querySelector("color");
        if (rFonts) {
          defaults.run.fontFamily = rFonts.getAttribute("w:ascii") ?? rFonts.getAttribute("w:hAnsi") ?? null;
        }
        if (sz) {
          const v = Number(sz.getAttribute("w:val"));
          if (Number.isFinite(v)) defaults.run.fontSizePt = halfPointsToPt(v);
        }
        if (color) {
          const cv = color.getAttribute("w:val");
          if (cv && cv !== "auto") defaults.run.color = cv.startsWith("#") ? cv : `#${cv}`;
        }
      }
      const pPrDefault = docDefaults.querySelector("pPrDefault pPr") as Element | null;
      if (pPrDefault) {
        const jc = pPrDefault.querySelector("jc")?.getAttribute("w:val") ?? undefined;
        defaults.paragraph.alignment = parseJc(jc);
        const ind = pPrDefault.querySelector("ind");
        if (ind) {
          const fl = Number(ind.getAttribute("w:firstLine"));
          if (Number.isFinite(fl)) defaults.paragraph.firstLineIndentMm = twipsToMm(fl);
          const l = Number(ind.getAttribute("w:left"));
          if (Number.isFinite(l)) defaults.paragraph.leftIndentMm = twipsToMm(l);
        }
        const spacing = pPrDefault.querySelector("spacing");
        if (spacing) {
          const line = Number(spacing.getAttribute("w:line"));
          const rule = spacing.getAttribute("w:lineRule") ?? "auto";
          if (Number.isFinite(line)) {
            if (rule === "exact") defaults.paragraph.lineSpacing = { kind: "exact", pt: line / 20 };
            else if (rule === "atLeast") defaults.paragraph.lineSpacing = { kind: "atLeast", pt: line / 20 };
            else defaults.paragraph.lineSpacing = { kind: "multiple", value: line / 240 };
          }
          const before = Number(spacing.getAttribute("w:before"));
          if (Number.isFinite(before)) defaults.paragraph.spacingBeforePt = eighthsToPt(before);
          const after = Number(spacing.getAttribute("w:after"));
          if (Number.isFinite(after)) defaults.paragraph.spacingAfterPt = eighthsToPt(after);
        }
      }
    }

    // Стили
    const styleEls = Array.from(stylesEl.children).filter((el) => el.localName === "style");
    for (const styleEl of styleEls) {
      const id = styleEl.getAttribute("w:styleId") ?? "";
      const nameEl = styleEl.querySelector("name");
      const name = nameEl?.getAttribute("w:val") ?? null;
      const basedOn = styleEl.querySelector("basedOn")?.getAttribute("w:val") ?? null;
      const type = styleEl.getAttribute("w:type") ?? null;
      const rPr = styleEl.querySelector("rPr") as Element | null;
      const pPr = styleEl.querySelector("pPr") as Element | null;
      const outlineLvlAttr = pPr?.querySelector("outlineLvl")?.getAttribute("w:val");
      const outlineLvl = outlineLvlAttr !== null && outlineLvlAttr !== undefined && outlineLvlAttr !== ""
        ? Number(outlineLvlAttr)
        : null;

      const entry: StyleEntry = {
        id,
        name,
        basedOn,
        type,
        run: rPr ? parseRunPrFromElement(rPr) : parseRunPr(undefined),
        paragraph: pPr ? parsePPrFromElement(pPr) : parsePPr(undefined),
        outlineLvl: outlineLvl !== null && Number.isFinite(outlineLvl) ? outlineLvl : null,
        headingLevel: null,
      };
      // «Заголовок N», «Heading N» → уровень
      const hm = name?.match(/^(?:заголовок|heading)\s+(\d)$/i);
      if (hm) entry.headingLevel = Number(hm[1]);
      else if (name && /^заголовок|heading/i.test(name)) entry.headingLevel = 1;

      byId.set(id, entry);
      if (name) byName.set(name.toLowerCase(), entry);
    }
  }

  return { defaults, byId, byName };
}

// --- Вспомогательные функции для разбора напрямую из DOM Element ---

function parseRunPrFromElement(rPr: Element): ResolvedRunFormat {
  const rFonts = rPr.querySelector("rFonts");
  const szEl = rPr.querySelector("sz");
  const colorEl = rPr.querySelector("color");
  const sz = szEl ? Number(szEl.getAttribute("w:val")) : null;
  const colorVal = colorEl?.getAttribute("w:val") ?? null;
  return {
    fontFamily: rFonts
      ? (rFonts.getAttribute("w:ascii") ?? rFonts.getAttribute("w:hAnsi") ?? rFonts.getAttribute("w:cs") ?? null)
      : null,
    fontSizePt: sz !== null && Number.isFinite(sz) ? halfPointsToPt(sz) : null,
    bold: rPr.querySelector("b") ? (Number(rPr.querySelector("b")!.getAttribute("w:val") ?? "1") || 1) !== 0 : null,
    italic: rPr.querySelector("i") ? (Number(rPr.querySelector("i")!.getAttribute("w:val") ?? "1") || 1) !== 0 : null,
    underline: rPr.querySelector("u") ? rPr.querySelector("u")!.getAttribute("w:val") !== "none" : null,
    color: colorVal && colorVal !== "auto" ? (colorVal.startsWith("#") ? colorVal : `#${colorVal}`) : null,
  };
}

function parsePPrFromElement(pPr: Element): ResolvedParagraphFormat {
  const jc = pPr.querySelector("jc")?.getAttribute("w:val") ?? undefined;
  const ind = pPr.querySelector("ind");
  const spacing = pPr.querySelector("spacing");
  let lineSpacing: LineSpacing | null = null;
  const lineAttr = spacing?.getAttribute("w:line");
  const line = lineAttr !== null && lineAttr !== undefined ? Number(lineAttr) : null;
  const rule = spacing?.getAttribute("w:lineRule") ?? "auto";
  if (line !== null && Number.isFinite(line)) {
    if (rule === "exact") lineSpacing = { kind: "exact", pt: line / 20 };
    else if (rule === "atLeast") lineSpacing = { kind: "atLeast", pt: line / 20 };
    else lineSpacing = { kind: "multiple", value: line / 240 };
  }
  const firstLineAttr = ind?.getAttribute("w:firstLine");
  const firstLine = firstLineAttr !== null && firstLineAttr !== undefined ? Number(firstLineAttr) : null;
  const leftAttr = ind?.getAttribute("w:left");
  const left = leftAttr !== null && leftAttr !== undefined ? Number(leftAttr) : null;
  const beforeAttr = spacing?.getAttribute("w:before");
  const before = beforeAttr !== null && beforeAttr !== undefined ? Number(beforeAttr) : null;
  const afterAttr = spacing?.getAttribute("w:after");
  const after = afterAttr !== null && afterAttr !== undefined ? Number(afterAttr) : null;
  return {
    alignment: parseJc(jc),
    firstLineIndentMm: firstLine !== null && Number.isFinite(firstLine) ? twipsToMm(firstLine) : null,
    leftIndentMm: left !== null && Number.isFinite(left) ? twipsToMm(left) : null,
    lineSpacing,
    spacingBeforePt: before !== null && Number.isFinite(before) ? eighthsToPt(before) : null,
    spacingAfterPt: after !== null && Number.isFinite(after) ? eighthsToPt(after) : null,
  };
}

/** Экспорт для тестов. */
export { XmlElement as _XmlElementForTests };
