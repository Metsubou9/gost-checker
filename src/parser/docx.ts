import JSZip from "jszip";
import type {
  Alignment,
  DocSection,
  Figure,
  LineSpacing,
  PageSetup,
  ParsedDocument,
  Paragraph,
  ParagraphFormatting,
  ParagraphNumbering,
  Run,
  RunFormatting,
  Table,
} from "../core/model";
import { emuToMm, twipsToMm } from "../core/units";
import { classifyParagraphs } from "./headings";
import { parseStylesXml, type StyleEntry, type StyleTable } from "./styles";
import { parseXml, XmlElement } from "./xml";

/**
 * Парсер .docx (OOXML). .docx — это zip-архив с XML внутри:
 *  - word/document.xml — содержимое
 *  - word/styles.xml   — стили (наследование docDefaults → basedOn → прямое)
 *  - word/numbering.xml— нумерованные списки
 *  - футеры/хедеры     — для проверки нумерации страниц
 */

interface NumberingDef {
  format: string | null;
  text: string | null;
}

interface DirectPPr {
  alignment: Alignment;
  firstLineMm: number | null;
  leftMm: number | null;
  lineSpacing: LineSpacing | null;
  beforePt: number | null;
  afterPt: number | null;
  styleId: string | null;
  numId: number | null;
  ilvl: number | null;
  outlineLvl: number | null;
}

interface Ctx {
  paragraphs: Paragraph[];
  tables: Table[];
  figures: Figure[];
  counter: number;
  sectionIndex: number;
  styleTable: StyleTable;
  numberingMap: Map<string, NumberingDef>;
  warnings: string[];
}

function assignDefined(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(source)) {
    if (v !== null && v !== undefined) target[k] = v;
  }
}

function parseAlignmentValue(jc: string | undefined): Alignment {
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

function attrToMm(el: XmlElement | undefined, attr: string): number | null {
  const v = el?.attrNum(attr);
  return v !== null && v !== undefined ? twipsToMm(v) : null;
}

function attrScaled(el: XmlElement | undefined, attr: string, scale: number): number | null {
  const v = el?.attrNum(attr);
  return v !== null && v !== undefined ? v / scale : null;
}

function parseRunPrXml(rPr: XmlElement | undefined): Partial<RunFormatting> {
  if (!rPr) return {};
  const out: Partial<RunFormatting> = {};
  const rFonts = rPr.child("rFonts");
  const ascii = rFonts?.attr("ascii") ?? rFonts?.attr("hAnsi");
  if (ascii) out.fontFamily = ascii;
  const sz = rPr.child("sz")?.attrNum("val");
  if (sz !== null && sz !== undefined) out.fontSizePt = sz / 2;
  const b = rPr.child("b");
  if (b) out.bold = (b.attrNum("val") ?? 1) !== 0;
  const i = rPr.child("i");
  if (i) out.italic = (i.attrNum("val") ?? 1) !== 0;
  const u = rPr.child("u");
  if (u) out.underline = u.attr("val") !== "none";
  const color = rPr.child("color")?.attr("val");
  if (color && color !== "auto") out.color = color.startsWith("#") ? color : `#${color}`;
  return out;
}

function parsePPrXml(pPr: XmlElement | undefined): DirectPPr {
  const empty: DirectPPr = {
    alignment: "unknown",
    firstLineMm: null,
    leftMm: null,
    lineSpacing: null,
    beforePt: null,
    afterPt: null,
    styleId: null,
    numId: null,
    ilvl: null,
    outlineLvl: null,
  };
  if (!pPr) return empty;
  const ind = pPr.child("ind");
  const spacing = pPr.child("spacing");
  const line = spacing?.attrNum("line") ?? null;
  const rule = spacing?.attr("lineRule") ?? "auto";
  let lineSpacing: LineSpacing | null = null;
  if (line !== null) {
    if (rule === "exact") lineSpacing = { kind: "exact", pt: line / 20 };
    else if (rule === "atLeast") lineSpacing = { kind: "atLeast", pt: line / 20 };
    else lineSpacing = { kind: "multiple", value: line / 240 };
  }
  const numPr = pPr.child("numPr");
  return {
    alignment: parseAlignmentValue(pPr.child("jc")?.attr("val")),
    firstLineMm: attrToMm(ind, "firstLine"),
    leftMm: attrToMm(ind, "left"),
    lineSpacing,
    beforePt: attrScaled(spacing, "before", 8),
    afterPt: attrScaled(spacing, "after", 8),
    styleId: pPr.child("pStyle")?.attr("val") ?? null,
    numId: numPr?.child("numId")?.attrNum("val") ?? null,
    ilvl: numPr?.child("ilvl")?.attrNum("val") ?? null,
    outlineLvl: pPr.child("outlineLvl")?.attrNum("val") ?? null,
  };
}

function styleChain(styleId: string | null, table: StyleTable): StyleEntry[] {
  const chain: StyleEntry[] = [];
  const seen = new Set<string>();
  let cur = styleId ? table.byId.get(styleId) : undefined;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.push(cur);
    cur = cur.basedOn ? table.byId.get(cur.basedOn) : undefined;
  }
  return chain;
}

function resolveRun(rPr: XmlElement | undefined, chain: StyleEntry[], table: StyleTable): RunFormatting {
  const acc: Record<string, unknown> = { ...table.defaults.run };
  for (const st of chain) assignDefined(acc, st.run as unknown as Record<string, unknown>);
  assignDefined(acc, parseRunPrXml(rPr) as Record<string, unknown>);
  return acc as unknown as RunFormatting;
}

function resolveParagraphFormatting(
  direct: DirectPPr,
  chain: StyleEntry[],
  table: StyleTable,
): { formatting: ParagraphFormatting; headingLevel: number | null } {
  const fmt: Record<string, unknown> = { ...table.defaults.paragraph };
  for (const st of chain) assignDefined(fmt, st.paragraph as unknown as Record<string, unknown>);
  if (direct.alignment !== "unknown") fmt.alignment = direct.alignment;
  assignDefined(fmt, {
    firstLineIndentMm: direct.firstLineMm,
    leftIndentMm: direct.leftMm,
    lineSpacing: direct.lineSpacing,
    spacingBeforePt: direct.beforePt,
    spacingAfterPt: direct.afterPt,
  });
  let headingLevel: number | null = null;
  if (direct.outlineLvl !== null) headingLevel = direct.outlineLvl + 1;
  else {
    for (let i = chain.length - 1; i >= 0; i--) {
      if (chain[i].headingLevel !== null) {
        headingLevel = chain[i].headingLevel;
        break;
      }
    }
  }
  return { formatting: fmt as unknown as ParagraphFormatting, headingLevel };
}

function collectRunText(r: XmlElement): string {
  let out = "";
  for (const c of r.children) {
    if (c.name === "t") out += c.text;
    else if (c.name === "tab") out += "\t";
    else if (c.name === "br" || c.name === "cr") out += "\n";
    else if (c.name === "noBreakHyphen") out += "-";
  }
  return out;
}

function paragraphHasImage(p: XmlElement): boolean {
  return p.descendants("drawing").length > 0 || p.descendants("pict").length > 0 || p.descendants("object").length > 0;
}

function imageExtentMm(p: XmlElement): { widthMm: number | null; heightMm: number | null } {
  const extent = p.descendants("extent")[0];
  if (extent) {
    const cx = extent.attrNum("cx");
    const cy = extent.attrNum("cy");
    return {
      widthMm: cx !== null ? emuToMm(cx) : null,
      heightMm: cy !== null ? emuToMm(cy) : null,
    };
  }
  return { widthMm: null, heightMm: null };
}

function parsePageSetup(sectPr: XmlElement): PageSetup {
  const pgSz = sectPr.child("pgSz");
  const pgMar = sectPr.child("pgMar");
  return {
    pageWidthMm: attrToMm(pgSz, "w") ?? 210,
    pageHeightMm: attrToMm(pgSz, "h") ?? 297,
    marginTopMm: attrToMm(pgMar, "top") ?? 20,
    marginBottomMm: attrToMm(pgMar, "bottom") ?? 20,
    marginLeftMm: attrToMm(pgMar, "left") ?? 30,
    marginRightMm: attrToMm(pgMar, "right") ?? 15,
    pageNumberInFooter: false,
    pageNumberInHeader: false,
  };
}

function hasPageNumberField(xml: string): boolean {
  try {
    const root = parseXml(xml);
    if (root) {
      for (const instr of root.descendants("instrText")) {
        if (/\bPAGE\b/.test(instr.text)) return true;
      }
      for (const fld of root.descendants("fldSimple")) {
        if (/\bPAGE\b/.test(fld.attr("instr") ?? "")) return true;
      }
      return false;
    }
  } catch {
    // fallback to regex below
  }
  return /\bPAGE\b/.test(xml);
}

function parseNumbering(xml: string, map: Map<string, NumberingDef>): void {
  const root = parseXml(xml);
  if (!root) return;
  const abstractFormats = new Map<string, Map<number, NumberingDef>>();
  for (const abs of root.childrenByName("abstractNum")) {
    const absId = abs.attr("abstractNumId");
    if (!absId) continue;
    const levels = new Map<number, NumberingDef>();
    for (const lvl of abs.childrenByName("lvl")) {
      const ilvl = lvl.attrNum("ilvl");
      if (ilvl === null) continue;
      levels.set(ilvl, {
        format: lvl.child("numFmt")?.attr("val") ?? null,
        text: lvl.child("lvlText")?.attr("val") ?? null,
      });
    }
    abstractFormats.set(absId, levels);
  }
  for (const num of root.childrenByName("num")) {
    const numId = num.attr("numId");
    const absId = num.child("abstractNumId")?.attr("val");
    if (!numId || !absId) continue;
    const levels = abstractFormats.get(absId);
    if (!levels) continue;
    for (const [ilvl, def] of levels) map.set(`${numId}:${ilvl}`, def);
  }
}

function walkParagraph(p: XmlElement, ctx: Ctx, parentParagraphId: string | null, inTable: boolean): void {
  const pPr = p.child("pPr");
  const direct = parsePPrXml(pPr);
  const chain = styleChain(direct.styleId, ctx.styleTable);
  const { formatting, headingLevel } = resolveParagraphFormatting(direct, chain, ctx.styleTable);

  const runs: Run[] = [];
  for (const r of p.childrenByName("r")) {
    runs.push({ text: collectRunText(r), formatting: resolveRun(r.child("rPr"), chain, ctx.styleTable) });
  }
  const text = runs.map((r) => r.text).join("");

  let numbering: ParagraphNumbering | null = null;
  if (direct.numId !== null) {
    const def = ctx.numberingMap.get(`${direct.numId}:${direct.ilvl ?? 0}`);
    numbering = {
      level: direct.ilvl ?? 0,
      textRepresentation: null,
      isOrdered: def ? def.format !== "bullet" : true,
    };
  }

  const id = `p${ctx.counter++}`;
  ctx.paragraphs.push({
    id,
    text,
    runs,
    sectionIndex: ctx.sectionIndex,
    parentParagraphId,
    inTable,
    formatting,
    numbering,
    structuralKind: "normal",
    headingLevel,
    approximatePage: null,
  });

  if (paragraphHasImage(p)) {
    const ext = imageExtentMm(p);
    ctx.figures.push({
      id: `f${ctx.figures.length}`,
      widthMm: ext.widthMm,
      heightMm: ext.heightMm,
      sectionIndex: ctx.sectionIndex,
      paragraphId: id,
    });
  }
}

function walkTable(tbl: XmlElement, ctx: Ctx, parentParagraphId: string | null, inTable: boolean): void {
  const rows = tbl.childrenByName("tr");
  let columns = 0;
  for (const tr of rows) columns = Math.max(columns, tr.childrenByName("tc").length);

  let captionParagraphId: string | null = null;
  for (let i = ctx.paragraphs.length - 1; i >= 0; i--) {
    const q = ctx.paragraphs[i];
    if (q.parentParagraphId === parentParagraphId && q.inTable === inTable) {
      captionParagraphId = q.id;
      break;
    }
  }

  ctx.tables.push({
    id: `t${ctx.tables.length}`,
    rows: rows.length,
    columns,
    sectionIndex: ctx.sectionIndex,
    captionParagraphId,
  });

  for (const tr of rows) {
    for (const tc of tr.childrenByName("tc")) {
      for (const child of tc.children) {
        if (child.name === "p" || child.name === "tbl" || child.name === "sdt") {
          walkBlock(child, ctx, null, true);
        }
      }
    }
  }
}

function walkBlock(el: XmlElement, ctx: Ctx, parentParagraphId: string | null, inTable: boolean): void {
  switch (el.name) {
    case "p":
      walkParagraph(el, ctx, parentParagraphId, inTable);
      break;
    case "tbl":
      walkTable(el, ctx, parentParagraphId, inTable);
      break;
    case "sdt": {
      const content = el.child("sdtContent");
      if (content) {
        for (const c of content.children) walkBlock(c, ctx, parentParagraphId, inTable);
      }
      break;
    }
    default:
      break;
  }
}

function emptyStyleTable(): StyleTable {
  return {
    defaults: {
      run: { fontFamily: null, fontSizePt: null, bold: null, italic: null, underline: null, color: null },
      paragraph: {
        alignment: "unknown",
        firstLineIndentMm: null,
        leftIndentMm: null,
        lineSpacing: null,
        spacingBeforePt: null,
        spacingAfterPt: null,
      },
    },
    byId: new Map(),
    byName: new Map(),
  };
}

/** Главная точка входа: разобрать .docx в ParsedDocument. */
export async function parseDocx(file: File): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const warnings: string[] = [];

  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) {
    throw new Error("В файле нет word/document.xml — похоже, это не .docx (переименован .doc или .zip?)");
  }
  const root = parseXml(await docXmlFile.async("string"));
  if (!root) throw new Error("word/document.xml пуст");
  const body = root.child("body");
  if (!body) throw new Error("word/document.xml не содержит <w:body>");

  // Стили
  let styleTable = emptyStyleTable();
  const stylesFile = zip.file("word/styles.xml");
  if (stylesFile) {
    try {
      styleTable = parseStylesXml(await stylesFile.async("string"));
    } catch (e) {
      warnings.push(`styles.xml не разобран: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Нумерация
  const numberingMap = new Map<string, NumberingDef>();
  const numberingFile = zip.file("word/numbering.xml");
  if (numberingFile) {
    try {
      parseNumbering(await numberingFile.async("string"), numberingMap);
    } catch (e) {
      warnings.push(`numbering.xml не разобран: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Связи (rId → файл)
  const rels = new Map<string, string>();
  const relsFile = zip.file("word/_rels/document.xml.rels");
  if (relsFile) {
    try {
      const relsRoot = parseXml(await relsFile.async("string"));
      if (relsRoot) {
        for (const rel of relsRoot.descendants("Relationship")) {
          const id = rel.attr("Id");
          const target = rel.attr("Target");
          if (id && target) rels.set(id, target);
        }
      }
    } catch (e) {
      warnings.push(`document.xml.rels не разобран: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const loadPart = async (target: string): Promise<string | null> => {
    const path = target.startsWith("/") ? target.slice(1) : `word/${target}`;
    const f = zip.file(path) ?? zip.file(decodeURIComponent(path));
    return f ? await f.async("string") : null;
  };

  // Секции (sectPr): промежуточные — в pPr абзацев, финальная — в конце body
  const sectPrList: { el: XmlElement; blockIdx: number }[] = [];
  body.children.forEach((el, idx) => {
    if (el.name !== "p") return;
    const sp = el.child("pPr")?.child("sectPr");
    if (sp) sectPrList.push({ el: sp, blockIdx: idx });
  });
  const finalSectPr = body.child("sectPr");
  if (finalSectPr) sectPrList.push({ el: finalSectPr, blockIdx: body.children.length });
  else if (sectPrList.length === 0) {
    sectPrList.push({ el: new XmlElement("sectPr", {}, [], ""), blockIdx: body.children.length });
  }

  const sections: DocSection[] = [];
  for (const { el: sectPr } of sectPrList) {
    const pageSetup = parsePageSetup(sectPr);
    for (const refType of ["footerReference", "headerReference"] as const) {
      for (const ref of sectPr.childrenByName(refType)) {
        const rId = ref.attr("id");
        const target = rId ? rels.get(rId) : null;
        if (!target) continue;
        const xml = await loadPart(target);
        if (xml && hasPageNumberField(xml)) {
          if (refType === "footerReference") pageSetup.pageNumberInFooter = true;
          else pageSetup.pageNumberInHeader = true;
        }
      }
    }
    sections.push({ id: `s${sections.length}`, pageSetup });
  }

  const boundaries = sectPrList.map((s) => s.blockIdx);
  const sectionIdxFor = (blockIdx: number): number => {
    let s = 0;
    for (const b of boundaries) {
      if (blockIdx <= b) break;
      s++;
    }
    return Math.min(s, sections.length - 1);
  };

  const ctx: Ctx = {
    paragraphs: [],
    tables: [],
    figures: [],
    counter: 0,
    sectionIndex: 0,
    styleTable,
    numberingMap,
    warnings,
  };

  body.children.forEach((el, idx) => {
    ctx.sectionIndex = sectionIdxFor(idx);
    walkBlock(el, ctx, null, false);
  });

  const doc: ParsedDocument = {
    sections,
    paragraphs: ctx.paragraphs,
    tables: ctx.tables,
    figures: ctx.figures,
    fileName: file.name,
    warnings,
  };
  classifyParagraphs(doc);
  return doc;
}
