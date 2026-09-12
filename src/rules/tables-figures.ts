import type { ParsedDocument, Paragraph, Rule, Violation } from "../core/model";
import { normalizeWhitespace } from "../core/text";
import { excerpt, topLevelParagraphs, violation } from "./helpers";

function loc(p: Paragraph): string {
  return `абзац «${excerpt(p.text, 40) ?? "…"}»`;
}

const CAPTION_RE = /^(таблица|рисунок)\s+([^\s—–-]+)\s*[—–-]?\s*(.*)$/i;

function findCaptions(doc: ParsedDocument): { kind: "tableCaption" | "figureCaption"; p: Paragraph; num: string; title: string }[] {
  const out: { kind: "tableCaption" | "figureCaption"; p: Paragraph; num: string; title: string }[] = [];
  for (const p of topLevelParagraphs(doc)) {
    if (p.structuralKind !== "tableCaption" && p.structuralKind !== "figureCaption") continue;
    const t = normalizeWhitespace(p.text);
    const m = t.match(CAPTION_RE);
    if (!m) continue;
    out.push({
      kind: p.structuralKind as "tableCaption" | "figureCaption",
      p,
      num: m[2],
      title: m[3] ?? "",
    });
  }
  return out;
}

function checkCaptionPresence(doc: ParsedDocument, _cfg: Record<string, unknown>): Violation[] {
  const out: Violation[] = [];
  const tablesWithoutCaption = doc.tables.filter((t) => {
    if (!t.captionParagraphId) return true;
    const cap = doc.paragraphs.find((p) => p.id === t.captionParagraphId);
    return !cap || cap.structuralKind !== "tableCaption";
  });
  for (const t of tablesWithoutCaption) {
    out.push(
      violation(
        "table-caption",
        "error",
        `Таблица (${t.rows}×${t.columns}) без подписи «Таблица N — …» над таблицей`,
        "ГОСТ 2.105-95, разд. 4.2 (таблицы)",
        `таблица ${doc.tables.indexOf(t) + 1}`,
        null,
        "Добавьте подпись над таблицей: слово «Таблица», её номер и название через тире.",
      ),
    );
  }
  return out;
}

function checkCaptionFormat(doc: ParsedDocument, cfg: Record<string, unknown>, kindFilter?: "tableCaption" | "figureCaption"): Violation[] {
  const out: Violation[] = [];
  const dashRe = cfg["dashFormat"] === "none" ? null : /[—–-]/;
  for (const { kind, p, num: n, title } of findCaptions(doc)) {
    if (kindFilter && kind !== kindFilter) continue;
    const word = kind === "tableCaption" ? "Таблица" : "Рисунок";
    const label = kind === "tableCaption" ? "над таблицей" : "под рисунком";
    if (dashRe && !dashRe.test(normalizeWhitespace(p.text))) {
      out.push(
        violation(
          kind === "tableCaption" ? "table-caption" : "figure-caption",
          "warning",
          `В подписи нет тире между номером и названием (рекомендуется «${word} ${n} — Название»)`,
          "ГОСТ 2.105-95 (типовая форма подписи)",
          loc(p),
          excerpt(p.text),
          `Оформите: «${word} ${n} — Название».`,
        ),
      );
    }
    if (!title.trim()) {
      out.push(
        violation(
          kind === "tableCaption" ? "table-caption" : "figure-caption",
          "warning",
          `В подписи нет названия (${label})`,
          "ГОСТ 2.105-95 (подпись включает название)",
          loc(p),
          excerpt(p.text),
          `Добавьте название после «${word} ${n} —».`,
        ),
      );
    }
  }
  return out;
}

function checkCaptionNumbering(doc: ParsedDocument, _cfg: Record<string, unknown>, kindFilter?: "tableCaption" | "figureCaption"): Violation[] {
  const out: Violation[] = [];
  for (const kind of ["tableCaption", "figureCaption"] as const) {
    if (kindFilter && kind !== kindFilter) continue;
    const word = kind === "tableCaption" ? "Таблица" : "Рисунок";
    const seen = new Map<string, number>();
    for (const c of findCaptions(doc)) {
      if (c.kind !== kind) continue;
      const key = c.num.replace(/\.$/, "");
      const count = (seen.get(key) ?? 0) + 1;
      seen.set(key, count);
      if (count > 1) {
        out.push(
          violation(
            kind === "tableCaption" ? "table-caption" : "figure-caption",
            "error",
            `Дублируется номер подписи: «${word} ${key}»`,
            "ГОСТ 2.105-95 (последовательная нумерация)",
            loc(c.p),
            excerpt(c.p.text),
            `Номера ${word.toLowerCase()} должны быть последовательными и уникальными.`,
          ),
        );
      }
    }
    // Проверка последовательности: 1, 2, 3...
    const nums = [...seen.keys()]
      .map((k) => ( /^\d+$/.test(k) ? Number(k) : null))
      .filter((n): n is number => n !== null)
      .sort((a, b) => a - b);
    for (let i = 0; i < nums.length; i++) {
      if (nums[i] !== i + 1) {
        out.push(
          violation(
            kind === "tableCaption" ? "table-caption" : "figure-caption",
            "warning",
            `Нумерация ${word.toLowerCase()} непоследовательна: найдено ${nums.join(", ")}`,
            "ГОСТ 2.105-95 (сквозная нумерация)",
            "весь документ",
            null,
            `Перенумеруйте: ${Array.from({ length: nums.length }, (_, i) => i + 1).join(", ")}.`,
          ),
        );
        break;
      }
    }
  }
  return out;
}

function checkFigureAlignment(doc: ParsedDocument, _cfg: Record<string, unknown>, kindFilter?: "tableCaption" | "figureCaption"): Violation[] {
  const out: Violation[] = [];
  for (const { kind, p } of findCaptions(doc)) {
    if (kindFilter && kind !== kindFilter) continue;
    if (kind === "figureCaption" && p.formatting.alignment !== "center") {
      out.push(
        violation(
          "figure-caption",
          "info",
          "Подпись к рисунку обычно центрируется",
          "ГОСТ 2.105-95 (подпись под рисунком, по центру)",
          loc(p),
          excerpt(p.text),
          "Отцентрируйте подпись под рисунком.",
        ),
      );
    }
    if (kind === "tableCaption" && p.formatting.alignment === "center") {
      out.push(
        violation(
          "table-caption",
          "info",
          "Подпись к таблице обычно выравнивается влево",
          "ГОСТ 2.105-95 (подпись над таблицей, слева)",
          loc(p),
          excerpt(p.text),
          "Выровняйте подпись над таблицей по левому краю (без абзацного отступа).",
        ),
      );
    }
  }
  return out;
}

export const tableCaptionRule: Rule = {
  id: "table-caption",
  title: "Подписи и нумерация таблиц",
  gostClause: "ГОСТ 2.105-95, разд. 4.2",
  severity: "error",
  description: "«Таблица N — Название» над таблицей; нумерация последовательная.",
  defaultConfig: { dashFormat: "dash" },
  check: (doc, cfg) => [...checkCaptionPresence(doc, cfg), ...checkCaptionFormat(doc, cfg, "tableCaption"), ...checkCaptionNumbering(doc, cfg, "tableCaption")],
};

export const figureCaptionRule: Rule = {
  id: "figure-caption",
  title: "Подписи и нумерация рисунков",
  gostClause: "ГОСТ 2.105-95, разд. 4.2",
  severity: "error",
  description: "«Рисунок N — Название» под рисунком по центру; нумерация последовательная.",
  defaultConfig: {},
  check: (doc, cfg) => [...checkCaptionFormat(doc, cfg, "figureCaption"), ...checkCaptionNumbering(doc, cfg, "figureCaption"), ...checkFigureAlignment(doc, cfg, "figureCaption")],
};
