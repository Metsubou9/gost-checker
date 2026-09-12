import type { ParsedDocument, Rule, Violation } from "../core/model";
import { bool, num, str, violation } from "./helpers";

function checkA4(doc: ParsedDocument, cfg: Record<string, unknown>): Violation[] {
  const out: Violation[] = [];
  const width = num(cfg, "widthMm", 210);
  const height = num(cfg, "heightMm", 297);
  const tolerance = num(cfg, "toleranceMm", 1);
  doc.sections.forEach((s, i) => {
    const ps = s.pageSetup;
    const wOk = Math.abs(ps.pageWidthMm - width) <= tolerance;
    const hOk = Math.abs(ps.pageHeightMm - height) <= tolerance;
    if (!wOk || !hOk) {
      out.push(
        violation(
          "page-a4",
          "error",
          `Размер страницы раздела ${i + 1} — ${ps.pageWidthMm}×${ps.pageHeightMm} мм, а должен быть ${width}×${height} мм (A4)`,
          "ГОСТ 2.301-68; ГОСТ 2.105-95, разд. 3",
          `раздел ${i + 1}`,
          null,
          "Задайте формат бумаги A4 (210×297 мм) в параметрах страницы.",
        ),
      );
    }
  });
  return out;
}

function checkMargins(doc: ParsedDocument, cfg: Record<string, unknown>): Violation[] {
  const out: Violation[] = [];
  const left = num(cfg, "leftMm", 30);
  const right = num(cfg, "rightMm", 15);
  const top = num(cfg, "topMm", 20);
  const bottom = num(cfg, "bottomMm", 20);
  const tolerance = num(cfg, "toleranceMm", 1);
  doc.sections.forEach((s, i) => {
    const ps = s.pageSetup;
    const checks: [string, number, number, string][] = [
      ["левое", ps.marginLeftMm, left, "30 мм"],
      ["правое", ps.marginRightMm, right, "15 мм"],
      ["верхнее", ps.marginTopMm, top, "20 мм"],
      ["нижнее", ps.marginBottomMm, bottom, "20 мм"],
    ];
    for (const [name, actual, expected, expectedStr] of checks) {
      if (Math.abs(actual - expected) > tolerance) {
        out.push(
          violation(
            "page-margins",
            "error",
            `Поле «${name}» в разделе ${i + 1} — ${actual} мм вместо ${expectedStr}`,
            "ГОСТ 2.105-95 (ЕСКД, поля формата по ГОСТ 2.301)",
            `раздел ${i + 1}`,
            null,
            `Установите поле «${name}» = ${expectedStr}.`,
          ),
        );
      }
    }
  });
  return out;
}

function checkPageNumbers(doc: ParsedDocument, cfg: Record<string, unknown>): Violation[] {
  const out: Violation[] = [];
  const position = str(cfg, "position", "bottom");
  const allowAny = bool(cfg, "allowAnyPosition", false);
  doc.sections.forEach((s, i) => {
    const ps = s.pageSetup;
    const inFooter = ps.pageNumberInFooter;
    const inHeader = ps.pageNumberInHeader;
    const absent = !inFooter && !inHeader;
    if (absent) {
      out.push(
        violation(
          "page-numbers",
          "warning",
          `В разделе ${i + 1} не обнаружен номер страницы в колонтитуле`,
          "ГОСТ 2.105-95, п. 4.1.13 (сквозная нумерация страниц)",
          `раздел ${i + 1}`,
          null,
          "Добавьте номера страниц (Вставка → Номер страницы), нумерация должна быть сквозной.",
        ),
      );
      return;
    }
    if (!allowAny && position === "bottom" && !inFooter && inHeader) {
      out.push(
        violation(
          "page-numbers",
          "info",
          `В разделе ${i + 1} номер страницы находится в верхнем колонтитуле`,
          "ГОСТ 2.105-95, п. 4.1.13",
          `раздел ${i + 1}`,
          null,
          "Обычно номер страницы размещают в нижней части листа (или по ГОСТ 2.106 — в верхней).",
        ),
      );
    }
  });
  return out;
}

export const pageA4: Rule = {
  id: "page-a4",
  title: "Формат бумаги A4",
  gostClause: "ГОСТ 2.301-68; ГОСТ 2.105-95, разд. 3",
  severity: "error",
  description: "Страницы должны иметь формат A4 (210×297 мм).",
  defaultConfig: { widthMm: 210, heightMm: 297, toleranceMm: 1 },
  check: checkA4,
};

export const pageMargins: Rule = {
  id: "page-margins",
  title: "Поля страницы",
  gostClause: "ГОСТ 2.105-95 (ЕСКД, поля по ГОСТ 2.301)",
  severity: "error",
  description: "Поля: левое 30 мм, правое 15 мм, верхнее 20 мм, нижнее 20 мм (типовые для ЕСКД; настраивается).",
  defaultConfig: { leftMm: 30, rightMm: 15, topMm: 20, bottomMm: 20, toleranceMm: 1 },
  check: checkMargins,
};

export const pageNumbers: Rule = {
  id: "page-numbers",
  title: "Нумерация страниц",
  gostClause: "ГОСТ 2.105-95, п. 4.1.13",
  severity: "warning",
  description: "Страницы должны иметь сквозную нумерацию (номер в колонтитуле).",
  defaultConfig: { position: "bottom", allowAnyPosition: false },
  check: checkPageNumbers,
};
