// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { parseXml } from "../src/parser/xml";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:t>Привет</w:t></w:r>
      <w:r><w:t> мир</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;

describe("xml parser", () => {
  it("strips namespaces from names", () => {
    const root = parseXml(SAMPLE)!;
    expect(root.name).toBe("document");
    const body = root.child("body")!;
    expect(body.children[0].name).toBe("p");
  });

  it("reads attributes without prefix", () => {
    const root = parseXml(SAMPLE)!;
    const jc = root.descendants("jc")[0];
    expect(jc?.attr("val")).toBe("center");
  });

  it("collects text content", () => {
    const root = parseXml(SAMPLE)!;
    const p = root.descendants("p")[0];
    expect(p.textContent).toContain("Привет");
  });

  it("descendants finds nested nodes", () => {
    const root = parseXml(SAMPLE)!;
    expect(root.descendants("r").length).toBe(2);
  });

  it("throws on malformed xml", () => {
    expect(() => parseXml("<w:document><w:body></w:document>")).toThrow();
  });
});
