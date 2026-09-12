import type { GostProfile, RuleConfig } from "../core/model";

interface Props {
  profile: GostProfile;
  overrides: Record<string, RuleConfig>;
  disabled: Set<string>;
  onChange: (overrides: Record<string, RuleConfig>, disabled: Set<string>) => void;
}

const NUM_KEYS = new Set([
  "sizePt", "multiple", "tolerance", "minMm", "maxMm", "toleranceMm",
  "widthMm", "heightMm", "leftMm", "rightMm", "topMm", "bottomMm",
  "minParagraphs", "minEntries", "maxBeforePt", "maxAfterPt",
]);

export function ConfigPanel({ profile, overrides, disabled, onChange }: Props) {
  const setOverride = (ruleId: string, key: string, value: number | string | boolean) => {
    const next = { ...overrides };
    const cur = { ...(next[ruleId] ?? {}), [key]: value };
    next[ruleId] = cur;
    onChange(next, disabled);
  };

  const toggleRule = (ruleId: string, on: boolean) => {
    const next = new Set(disabled);
    if (on) next.delete(ruleId);
    else next.add(ruleId);
    onChange(overrides, next);
  };

  return (
    <details className="rules" open>
      <summary>Правила профиля «{profile.name}»</summary>
      <div style={{ marginTop: 8 }}>
        {profile.rules.map((rule) => {
          const cfg = { ...rule.defaultConfig, ...(overrides[rule.id] ?? {}) };
          const off = disabled.has(rule.id);
          return (
            <div className="rule-row" key={rule.id}>
              <input
                type="checkbox"
                checked={!off}
                onChange={(e) => toggleRule(rule.id, e.target.checked)}
                title={off ? "Включить правило" : "Отключить правило"}
              />
              <div style={{ flex: 1 }}>
                <div>
                  {rule.title} <span className="rid">· {rule.gostClause}</span>
                </div>
                <div className="muted small">{rule.description}</div>
                <div className="row" style={{ marginTop: 4 }}>
                  {Object.entries(cfg).map(([k, v]) => {
                    if (typeof v === "boolean") {
                      return (
                        <label key={k} className="small">
                          <input
                            type="checkbox"
                            checked={v}
                            style={{ marginRight: 4 }}
                            onChange={(e) => setOverride(rule.id, k, e.target.checked)}
                          />
                          {k}
                        </label>
                      );
                    }
                    if (NUM_KEYS.has(k)) {
                      return (
                        <label key={k} className="small">
                          {k}{" "}
                          <input
                            type="number"
                            value={String(v)}
                            step="any"
                            style={{ width: 76 }}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              setOverride(rule.id, k, Number.isFinite(n) ? n : v);
                            }}
                          />
                        </label>
                      );
                    }
                    return (
                      <label key={k} className="small">
                        {k}{" "}
                        <input
                          type="text"
                          value={String(v)}
                          style={{ width: 140 }}
                          onChange={(e) => setOverride(rule.id, k, e.target.value)}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
