import { describe, expect, it } from "vitest";
import type { ParsedDocument, Paragraph, Run } from "../src/core/model";
import { ALL_RULES, ruleById } from "../src/rules";
import { runProfile } from "../src/rules/engine";
import { PROFILES } from "../src/profiles";
import { gost210595 } from "../src/profiles/gost-2-105-95";

/** Фабрика «идеального» по ГОСТ документа. */
function run(text: string, over: Partial<Run["formatting"]> = {}): Run {
  return {
    text,
    formatting: {
      fontFamily: "Times New Roman",
      fontSizePt: 14,
      bold: false,
      italic: false,
      underline: false,
      color: null,
      ...over,
    },
  };
}

let nextId = 0;
function para(text: string, over: Partial<Paragraph> = {}): Paragraph {
  return {
    id: `p${nextId++}`,
    text,
    runs: [run(text)],
    sectionIndex: 0,
    parentParagraphId: null,
    inTable: false,
    formatting: {
      alignment: "justify",
      firstLineIndentMm: 15.9,
      leftIndentMm: 0,
      lineSpacing: { kind: "multiple", value: 1.5 },
      spacingBeforePt: 0,
      spacingAfterPt: 0,
    },
    numbering: null,
    structuralKind: "normal",
    headingLevel: null,
    approximatePage: null,
    ...over,
  };
}

function doc(paras: Paragraph[], extra: Partial<ParsedDocument> = {}): ParsedDocument {
  return {
    sections: [
      {
        id: "s0",
        pageSetup: {
          pageWidthMm: 210,
          pageHeightMm: 297,
          marginTopMm: 20,
          marginBottomMm: 20,
          marginLeftMm: 30,
          marginRightMm: 15,
          pageNumberInFooter: true,
          pageNumberInHeader: false,
        },
      },
    ],
    paragraphs: paras,
    tables: [],
    figures: [],
    fileName: "test.docx",
    warnings: [],
    ...extra,
  };
}

const HEAD = (text: string, level: number): Paragraph =>
  para(text, { structuralKind: "heading", headingLevel: level });

describe("rules registry", () => {
  it("has unique ids", () => {
    const ids = ALL_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("profile includes all rules", () => {
    expect(gost210595.rules.length).toBe(ALL_RULES.length);
  });
  it("ruleById finds known rule", () => {
    expect(ruleById("page-margins")?.title).toBeTruthy();
  });
});

describe("page rules", () => {
  it("good document passes margins", () => {
    const d = doc([para("Обычный текст.")]);
    const res = runProfile(PROFILES[0], d).filter((r) => r.rule.id === "page-margins");
    expect(res[0].violations).toHaveLength(0);
  });
  it("wrong margin flagged", () => {
    const d = doc([para("Текст.")]);
    d.sections[0].pageSetup.marginLeftMm = 20;
    const res = runProfile(PROFILES[0], d).filter((r) => r.rule.id === "page-margins");
    expect(res[0].violations.length).toBeGreaterThan(0);
    expect(res[0].violations[0].message).toContain("левое");
  });
  it("A4 violation flagged", () => {
    const d = doc([para("Текст.")]);
    d.sections[0].pageSetup.pageWidthMm = 216;
    const res = runProfile(PROFILES[0], d).filter((r) => r.rule.id === "page-a4");
    expect(res[0].violations[0].severity).toBe("error");
  });
  it("missing page numbers flagged", () => {
    const d = doc([para("Текст.")]);
    d.sections[0].pageSetup.pageNumberInFooter = false;
    const res = runProfile(PROFILES[0], d).filter((r) => r.rule.id === "page-numbers");
    expect(res[0].violations.length).toBe(1);
  });
});

describe("typography rules", () => {
  it("wrong font flagged", () => {
    const d = doc([para("Текст Calibri", { runs: [run("Текст ", { fontFamily: "Calibri" })] })]);
    const res = runProfile(PROFILES[0], d).filter((r) => r.rule.id === "font-family");
    expect(res[0].violations[0].message).toContain("Calibri");
  });
  it("wrong size flagged", () => {
    const d = doc([para("Мелкий", { runs: [run("Мелкий", { fontSizePt: 12 })] })]);
    const res = runProfile(PROFILES[0], d).filter((r) => r.rule.id === "font-size");
    expect(res[0].violations.length).toBe(1);
  });
  it("single spacing flagged", () => {
    const d = doc([para("Плотно", { formatting: { ...para("").formatting, lineSpacing: { kind: "multiple", value: 1 } } })]);
    const res = runProfile(PROFILES[0], d).filter((r) => r.rule.id === "line-spacing");
    expect(res[0].violations.length).toBe(1);
  });
  it("indent out of range flagged", () => {
    const d = doc([para("Отступ", { formatting: { ...para("").formatting, firstLineIndentMm: 10 } })]);
    const res = runProfile(PROFILES[0], d).filter((r) => r.rule.id === "paragraph-indent");
    expect(res[0].violations[0].message).toContain("10");
  });
  it("alignment flagged", () => {
    const d = doc([para("Слева", { formatting: { ...para("").formatting, alignment: "left" } })]);
    const res = runProfile(PROFILES[0], d).filter((r) => r.rule.id === "text-alignment");
    expect(res[0].violations.length).toBe(1);
  });
});

describe("structure rules", () => {
  it("trailing dot in heading flagged", () => {
    const d = doc([HEAD("1 Введение.", 1)]);
    const res = runProfile(PROFILES[0], d).filter((r) => r.rule.id === "heading-trailing-dot");
    expect(res[0].violations.length).toBe(1);
  });
  it("lowercase heading flagged", () => {
    const d = doc([HEAD("1 введение", 1)]);
    const res = runProfile(PROFILES[0], d).filter((r) => r.rule.id === "heading-case");
    expect(res[0].violations.length).toBe(1);
  });
  it("underlined heading flagged", () => {
    const d = doc([HEAD("1 Введение", 1)]);
    d.paragraphs[0].runs[0].formatting.underline = true;
    const res = runProfile(PROFILES[0], d).filter((r) => r.rule.id === "heading-underline");
    expect(res[0].violations.length).toBe(1);
  });
  it("broken numbering flagged", () => {
    const d = doc([HEAD("1 Первый", 1), HEAD("3 Третий", 1)]);
    const res = runProfile(PROFILES[0], d).filter((r) => r.rule.id === "heading-numbering");
    expect(res[0].violations.length).toBe(1);
    expect(res[0].violations[0].message).toContain("2");
  });
  it("good heading numbering passes", () => {
    const d = doc([HEAD("1 Первый", 1), HEAD("1.1 Подраздел", 2), HEAD("2 Второй", 1)]);
    const res = runProfile(PROFILES[0], d).filter((r) => r.rule.id === "heading-numbering");
    expect(res[0].violations).toHaveLength(0);
  });
});

describe("tables and figures rules", () => {
  it("table without caption flagged", () => {
    const tbl = { id: "t0", rows: 2, columns: 3, sectionIndex: 0, captionParagraphId: null };
    const d = doc([para("Текст")], { tables: [tbl] });
    const res = runProfile(PROFILES[0], d).filter((r) => r.rule.id === "table-caption");
    expect(res[0].violations.length).toBe(1);
  });
  it("table with caption passes", () => {
    const cap = para("Таблица 1 — Данные", { structuralKind: "tableCaption" });
    const tbl = { id: "t0", rows: 2, columns: 3, sectionIndex: 0, captionParagraphId: cap.id };
    const d = doc([cap, para("Текст")], { tables: [tbl] });
    const res = runProfile(PROFILES[0], d).filter((r) => r.rule.id === "table-caption");
    expect(res[0].violations).toHaveLength(0);
  });
  it("duplicate figure numbers flagged", () => {
    const f1 = para("Рисунок 1 — Один", { structuralKind: "figureCaption", formatting: { ...para("").formatting, alignment: "center" } });
    const f2 = para("Рисунок 1 — Два", { structuralKind: "figureCaption", formatting: { ...para("").formatting, alignment: "center" } });
    const d = doc([f1, f2]);
    const res = runProfile(PROFILES[0], d).filter((r) => r.rule.id === "figure-caption");
    expect(res[0].violations.length).toBeGreaterThan(0);
  });
});

describe("references rules", () => {
  it("missing references flagged", () => {
    const d = doc([para("Текст работы")]);
    const res = runProfile(PROFILES[0], d).filter((r) => r.rule.id === "references-present");
    expect(res[0].violations.length).toBe(1);
  });
  it("references with broken numbering flagged", () => {
    const head = para("Список использованных источников", { structuralKind: "referencesHeading" });
    const e1 = para("1 Иванов И.И. Книга. М.: Наука, 2020. 100 с.", { structuralKind: "referenceEntry" });
    const e2 = para("5 Петров П.П. Другая книга. СПб.: Питер, 2021. 50 с.", { structuralKind: "referenceEntry" });
    const d = doc([head, e1, e2]);
    const res = runProfile(PROFILES[0], d).filter((r) => r.rule.id === "references-numbering");
    expect(res[0].violations.length).toBe(1);
    expect(res[0].violations[0].message).toContain("2");
  });
  it("entry without year is info", () => {
    const head = para("Список литературы", { structuralKind: "referencesHeading" });
    const e1 = para("1 Иванов И.И. Книга без года. М.: Наука. 100 с.", { structuralKind: "referenceEntry" });
    const d = doc([head, e1]);
    const res = runProfile(PROFILES[0], d).filter((r) => r.rule.id === "references-pattern");
    expect(res[0].violations[0].severity).toBe("info");
  });
});
