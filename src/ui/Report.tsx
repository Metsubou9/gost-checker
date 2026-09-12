import type { Severity, Violation } from "../core/model";
import type { RuleResult } from "../rules/engine";

interface Props {
  fileName: string;
  profileName: string;
  results: RuleResult[];
  counts: Record<Severity, number>;
  onDownload: () => void;
}

const SEV_LABEL: Record<Severity, string> = {
  error: "ошибка",
  warning: "предупреждение",
  info: "замечание",
};

export function Report({ fileName, profileName, results, counts, onDownload }: Props) {
  const total = counts.error + counts.warning + counts.info;
  const resultsWithViolations = results.filter((r) => r.violations.length > 0 || r.error);

  return (
    <div className="card">
      <div className="spread">
        <h3 style={{ margin: 0 }}>
          Отчёт по {fileName} · {profileName}
        </h3>
        <button onClick={onDownload}>Скачать отчёт (Markdown)</button>
      </div>

      <div className="summary" style={{ margin: "12px 0" }}>
        <div className={`stat ${counts.error ? "err" : "ok"}`}>
          <div className="n">{counts.error}</div>
          <div className="lbl">ошибок</div>
        </div>
        <div className="stat warn">
          <div className="n">{counts.warning}</div>
          <div className="lbl">предупреждений</div>
        </div>
        <div className="stat info">
          <div className="n">{counts.info}</div>
          <div className="lbl">замечаний</div>
        </div>
        <div className="stat">
          <div className="n">{total === 0 ? "✓" : total}</div>
          <div className="lbl">{total === 0 ? "нарушений нет" : "всего"}</div>
        </div>
      </div>

      {total === 0 && !resultsWithViolations.length && (
        <p style={{ color: "var(--ok)" }}>
          Нарушений не найдено. Учтите: проверяются только правила, поддерживаемые приложением.
        </p>
      )}

      {resultsWithViolations.map(({ rule, violations, error }) => (
        <div key={rule.id} style={{ marginBottom: 14 }}>
          <div className="spread">
            <b>{rule.title}</b>
            <span className="muted small">{rule.gostClause}</span>
          </div>
          {error && <div className="error-box small">Правило упало с ошибкой: {error}</div>}
          {violations.map((v, i) => (
            <ViolationCard key={i} v={v} />
          ))}
        </div>
      ))}
    </div>
  );
}

function ViolationCard({ v }: { v: Violation }) {
  return (
    <div className={`violation ${v.severity}`}>
      <div className="spread">
        <span className={`badge ${v.severity}`}>{SEV_LABEL[v.severity]}</span>
        <span className="muted small">{v.location}</span>
      </div>
      <div className="msg">{v.message}</div>
      {v.excerpt && <div className="excerpt">«{v.excerpt}»</div>}
      {v.suggestion && <div className="sugg">→ {v.suggestion}</div>}
    </div>
  );
}
