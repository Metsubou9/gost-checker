/**
 * Генератор демо-файлов: public/samples/gost-good.docx и gost-bad.docx.
 * Запуск: node scripts/make-fixtures.mjs
 */
import JSZip from "jszip";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "samples");
mkdirSync(outDir, { recursive: true });

const XMLDECL = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;

const runXml = (text, rPr = "") =>
  `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${text}</w:t></w:r>`;

const pXml = (text, pPr = "", rPr = "") =>
  `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}${runXml(text, rPr)}</w:p>`;

const GOOD_PPR = `<w:jc w:val="both"/><w:spacing w:line="360" w:lineRule="auto"/><w:ind w:firstLine="900"/>`;
const GOOD_RPR = `<w:rFonts w:ascii="Times New Roman"/><w:sz w:val="28"/>`;

const sectPr = (footerRef) => `
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
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
</w:styles>`;

const FOOTER = `${XMLDECL}
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>
</w:ftr>`;

const RELS = `${XMLDECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdFtr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`;

const CONTENT_TYPES = `${XMLDECL}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

function documentXml(body) {
  return `${XMLDECL}
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>${body}${sectPr('<w:footerReference w:type="default" r:id="rIdFtr1"/>')}</w:body>
</w:document>`;
}

const goodBody = [
  pXml("1 Первый раздел", `<w:outlineLvl w:val="0"/><w:jc w:val="left"/>`),
  pXml("Текст первого раздела оформлен корректно.", GOOD_PPR, GOOD_RPR),
  pXml("1.1 Подраздел", `<w:outlineLvl w:val="1"/><w:jc w:val="left"/>`),
  pXml("Текст подраздела.", GOOD_PPR, GOOD_RPR),
  pXml("Таблица 1 — Основные данные", `<w:jc w:val="left"/><w:ind w:firstLine="0"/>`),
  `<w:tbl><w:tr><w:tc><w:p>${pXml("А")}</w:p></w:tc><w:tc><w:p>${pXml("Б")}</w:p></w:tc></w:tr><w:tr><w:tc><w:p>${pXml("1")}</w:p></w:tc><w:tc><w:p>${pXml("2")}</w:p></w:tc></w:tr></w:tbl>`,
  pXml("Текст после таблицы.", GOOD_PPR, GOOD_RPR),
  pXml("Список использованных источников"),
  pXml("1 Иванов И.И. Основы стандартизации. М.: Наука, 2020. 100 с."),
  pXml("2 Петров П.П. Документация в машиностроении. СПб.: Питер, 2021. 50 с."),
].join("");

const badBody = [
  pXml("1 Введение.", `<w:outlineLvl w:val="0"/><w:jc w:val="left"/>`),
  pXml("Текст набран шрифтом Calibri и одинарным интервалом.", `<w:jc w:val="left"/><w:spacing w:line="240" w:lineRule="auto"/><w:ind w:firstLine="500"/>`, `<w:rFonts w:ascii="Calibri"/><w:sz w:val="24"/><w:color w:val="FF0000"/>`),
  pXml("2.1 Ошибка нумерации", `<w:outlineLvl w:val="1"/><w:jc w:val="left"/>`),
  pXml("Ещё текст.", GOOD_PPR, GOOD_RPR),
  pXml("Таблица 1 — Данные", `<w:jc w:val="left"/><w:ind w:firstLine="0"/>`),
  `<w:tbl><w:tr><w:tc><w:p/></w:tc><w:tc><w:p/></w:tc></w:tr></w:tbl>`,
  pXml("Таблица 1 — Дублированная подпись", `<w:jc w:val="left"/><w:ind w:firstLine="0"/>`),
  pXml("Текст.", GOOD_PPR, GOOD_RPR),
  pXml("Список литературы"),
  pXml("1 Книга без года издания"),
  pXml("5 Снова Иванов. М.: Наука, 2020. 100 с."),
].join("");

async function make(name, body) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("word/document.xml", documentXml(body));
  zip.file("word/styles.xml", STYLES);
  zip.file("word/_rels/.rels", `${XMLDECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.file("word/_rels/document.xml.rels", RELS);
  zip.file("word/footer1.xml", FOOTER);
  const buf = await zip.generateAsync({ type: "nodebuffer" });
  writeFileSync(join(outDir, name), buf);
  console.log(`ok: public/samples/${name}`);
}

await make("gost-good.docx", goodBody);
await make("gost-bad.docx", badBody);
