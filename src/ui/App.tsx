import { useCallback, useState } from "react";
import type { ParsedDocument, RuleConfig, Violation } from "../core/model";
import { parseDocx } from "../parser/docx";
import { PROFILES, profileById } from "../profiles";
import { runProfile, type RuleResult } from "../rules/engine";
import { Dropzone } from "./Dropzone";
import { ConfigPanel } from "./ConfigPanel";
import { Report } from "./Report";
import { toMarkdown } from "./markdownExport";

interface ErrorState {
  title: string;
  detail: string;
}

export default function App() {
  const [status, setStatus] = useState<"idle" | "parsing" | "checking" | "done" | "error">("idle");
  const [error, setError] = useState<ErrorState | null>(null);
  const [doc, setDoc] = useState<ParsedDocument | null>(null);
  const [results, setResults] = useState<RuleResult[]>([]);
  const [profileId, setProfileId] = useState<string>(PROFILES[0].id);
  const [overrides, setOverrides] = useState<Record<string, RuleConfig>>({});
  const [disabledRules, setDisabledRules] = useState<Set<string>>(new Set());
  const [showConfig, setShowConfig] = useState(false);

  const profile = profileById(profileId) ?? PROFILES[0];

  const check = useCallback(
    (d: ParsedDocument) => {
      setStatus("checking");
      try {
        const res = runProfile(profile, d, overrides).filter((r) => !disabledRules.has(r.rule.id));
        setResults(res);
        setStatus("done");
      } catch (e) {
        setError({ title: "Ошибка проверки", detail: String(e) });
        setStatus("error");
      }
    },
    [profile, overrides, disabledRules],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setStatus("parsing");
      setDoc(null);
      setResults([]);
      try {
        const parsed = await parseDocx(file);
        setDoc(parsed);
        check(parsed);
      } catch (e) {
        setError({
          title: "Не удалось прочитать файл",
          detail: e instanceof Error ? e.message : String(e),
        });
        setStatus("error");
      }
    },
    [check],
  );

  const rerun = useCallback(() => {
    if (doc) check(doc);
  }, [doc, check]);

  const activeViolations: Violation[] = results.flatMap((r) => r.violations);
  const counts = {
    error: activeViolations.filter((v) => v.severity === "error").length,
    warning: activeViolations.filter((v) => v.severity === "warning").length,
    info: activeViolations.filter((v) => v.severity === "info").length,
  };

  const download = useCallback(() => {
    const md = toMarkdown(doc?.fileName ?? "document.docx", profile, results);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gost-report-${(doc?.fileName ?? "document").replace(/\.docx$/i, "")}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [doc, profile, results]);

  return (
    <div className="wrap">
      <header className="top">
        <h1>GOST Checker</h1>
        <span className="sub">проверка .docx на соответствие ГОСТ · файлы не покидают браузер</span>
      </header>

      {error && (
        <div className="error-box">
          <b>{error.title}</b>
          <div>{error.detail}</div>
        </div>
      )}

      <div className="card">
        <Dropzone onFile={handleFile} busy={status === "parsing" || status === "checking"} />
      </div>

      {doc && (
        <div className="card">
          <div className="spread">
            <div className="row">
              <span>
                <b>{doc.fileName}</b>
              </span>
              <span className="muted small">
                {doc.paragraphs.length} абзацев · {doc.tables.length} таблиц · {doc.figures.length} рисунков ·
                {" "}разделов: {doc.sections.length}
              </span>
            </div>
            <div className="row">
              <select value={profileId} onChange={(e) => setProfileId(e.target.value)} aria-label="Профиль ГОСТ">
                {PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button onClick={() => setShowConfig((v) => !v)}>{showConfig ? "Скрыть настройки" : "Настройки правил"}</button>
              <button className="primary" onClick={rerun}>
                Проверить снова
              </button>
            </div>
          </div>
          {doc.warnings.length > 0 && (
            <div className="muted small" style={{ marginTop: 8 }}>
              Предупреждения разбора: {doc.warnings.join("; ")}
            </div>
          )}
          {showConfig && (
            <ConfigPanel
              profile={profile}
              overrides={overrides}
              disabled={disabledRules}
              onChange={(o, d) => {
                setOverrides(o);
                setDisabledRules(d);
                setTimeout(() => check(doc), 0);
              }}
            />
          )}
        </div>
      )}

      {status === "done" && (
        <Report fileName={doc?.fileName ?? "document.docx"} profileName={profile.name} results={results} counts={counts} onDownload={download} />
      )}

      {status === "idle" && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Что проверяется</h3>
          <ul className="muted">
            <li>Страница: формат A4, поля, нумерация страниц</li>
            <li>Шрифт: гарнитура (Times New Roman), кегль 14, полуторный интервал, отступ 15–17 мм, выравнивание по ширине</li>
            <li>Структура: нумерация и оформление заголовков, содержание, раздел с нового листа</li>
            <li>Таблицы и рисунки: подписи «Таблица N — …» / «Рисунок N — …», нумерация, выравнивание</li>
            <li>Список литературы: наличие, нумерация, элементы описания</li>
          </ul>
          <p className="muted small">
            Все параметры правил настраиваются — методички вузов различаются. Загруженный файл обрабатывается
            локально: он никуда не отправляется.
          </p>
        </div>
      )}

      <footer>
        GOST Checker · правила по ГОСТ 2.105-95 (ЕСКД) · отчёт можно скачать в Markdown · MIT
      </footer>
    </div>
  );
}
