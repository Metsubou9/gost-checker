// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { parseDocx } from "../src/parser/docx";
import { runProfile } from "../src/rules/engine";
import { gost210595 } from "../src/profiles/gost-2-105-95";

const XMLDECL = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;

const runXml = (text: string, rPr = "") => `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${text}</w:t></w:r>`;

const pXml = (text: string, pPr = "", rPr = "") =>
  `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}${runXml(text, rPr)}</w:p>`;

// Абзац «идеального» ГОСТ-документа: по ширине, 1.5 (360), отступ 900 twips (15.9 мм)
const GOOD_PPR = `<w:jc w:val="both"/><w:spacing w:line="360" w:lineRule="auto"/><w:ind w:firstLine="900"/>`;
const GOOD_RPR = `<w:rFonts w:ascii="Times New Roman"/><w:sz w:val="28"/>`;

const sectPr = (footerRef = "") => `
  <w:sectPr>
    <w:pgSz w:w="11906" w:h="16838"/>
    <w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>
    ${footerRef}
  </w:sectPr>`;

const STYLES = `${XMLDECL}
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="28"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
  </w:style>
</w:styles>`;

const FOOTER = `${XMLDECL}
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>
</w:ftr>`;

const RELS = `${XMLDECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdFtr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`;

function docXml(bodyContent: string): string {
  return `${XMLDECL}
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyContent}${sectPr('<w:footerReference w:type="default" r:id="rIdFtr1"/>')}</w:body>
</w:document>`;
}

async function makeDocx(parts: Record<string, string>): Promise<File> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(parts)) zip.file(path, content);
  const buf = await zip.generateAsync({ type: "arraybuffer" });
  return new File([buf], "test.docx");
}

async function parse(parts: Record<string, string>) {
  const file = await makeDocx({
    "word/document.xml": docXml(parts.body),
    "word/styles.xml": parts.styles ?? STYLES,
    "word/_rels/document.xml.rels": RELS,
    ...(parts.footer === null ? {} : { "word/footer1.xml": parts.footer ?? FOOTER }),
  });
  return parseDocx(file);
}

describe("docx parser (e2e)", () => {
  it("parses paragraphs, runs, and section setup", async () => {
    const doc = await parse({ body: pXml("Обычный текст", GOOD_PPR, GOOD_RPR) });
    expect(doc.paragraphs).toHaveLength(1);
    expect(doc.paragraphs[0].text).toBe("Обычный текст");
    expect(doc.paragraphs[0].formatting.alignment).toBe("justify");
    expect(doc.paragraphs[0].formatting.lineSpacing).toEqual({ kind: "multiple", value: 1.5 });
    expect(doc.paragraphs[0].formatting.firstLineIndentMm).toBeCloseTo(15.88, 1);
    expect(doc.paragraphs[0].runs[0].formatting.fontSizePt).toBe(14);
    expect(doc.paragraphs[0].runs[0].formatting.fontFamily).toBe("Times New Roman");
    expect(doc.sections[0].pageSetup.marginLeftMm).toBeCloseTo(30, 0);
    expect(doc.sections[0].pageSetup.pageNumberInFooter).toBe(true);
  });

  it("parses tables and links captions", async () => {
    const body =
      pXml("Таблица 1 — Данные", `<w:jc w:val="left"/><w:ind w:firstLine="0"/>`) +
      `<w:tbl><w:tr><w:tc><w:p>${""}</w:p></w:tc><w:tc><w:p/></w:tc></w:tr><w:tr><w:tc><w:p/></w:tc><w:tc><w:p/></w:tc></w:tr></w:tbl>`;
    const doc = await parse({ body });
    expect(doc.tables).toHaveLength(1);
    expect(doc.tables[0].rows).toBe(2);
    expect(doc.tables[0].columns).toBe(2);
    expect(doc.tables[0].captionParagraphId).toBe(doc.paragraphs[0].id);
    // Абзац перед таблицей распознан как подпись
    expect(doc.paragraphs[0].structuralKind).toBe("tableCaption");
  });

  it("classifies headings and reference entries", async () => {
    const body =
      pXml("1 Введение", `<w:outlineLvl w:val="0"/>`) +
      pXml("Текст работы.", GOOD_PPR, GOOD_RPR) +
      pXml("Список использованных источников") +
      pXml("1 Иванов И.И. Книга. М.: Наука, 2020. 100 с.");
    const doc = await parse({ body });
    expect(doc.paragraphs[0].structuralKind).toBe("heading");
    expect(doc.paragraphs[0].headingLevel).toBe(1);
    expect(doc.paragraphs[2].structuralKind).toBe("referencesHeading");
    expect(doc.paragraphs[3].structuralKind).toBe("referenceEntry");
  });

  it("warns on missing document.xml", async () => {
    const file = await makeDocx({ "word/other.xml": "<x/>" });
    await expect(parseDocx(file)).rejects.toThrow(/document\.xml/);
  });
});

describe("profile e2e on parsed docx", () => {
  it("ideal document produces no errors", async () => {
    const body =
      pXml("1 Первый раздел", `<w:outlineLvl w:val="0"/>`) +
      pXml("Текст первого раздела.", GOOD_PPR, GOOD_RPR) +
      pXml("Список использованных источников") +
      pXml("1 Иванов И.И. Книга. М.: Наука, 2020. 100 с.");
    const doc = await parse({ body });
    const results = runProfile(gost210595, doc);
    const errors = results.flatMap((r) => r.violations).filter((v) => v.severity === "error");
    expect(errors).toEqual([]);
  });

  it("bad document produces violations", async () => {
    const body =
      pXml("2 Введение.", `<w:outlineLvl w:val="0"/><w:jc w:val="left"/>`) +
      pXml("Текст с плохим шрифтом.", GOOD_PPR, `<w:rFonts w:ascii="Calibri"/><w:sz w:val="24"/>`) +
      pXml("Список использованных источников") +
      pXml("1 Книга без года и кавычек \"x\"");
    const doc = await parse({ body });
    const results = runProfile(gost210595, doc);
    const ids = new Set(results.flatMap((r) => r.violations).map((v) => v.ruleId));
    expect(ids.has("heading-trailing-dot")).toBe(true);
    expect(ids.has("font-family")).toBe(true);
    expect(ids.has("font-size")).toBe(true);
    expect(ids.has("references-pattern")).toBe(true);
  });
});
