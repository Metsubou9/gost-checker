import type { GostProfile, ParsedDocument, Rule, RuleConfig, Violation } from "../core/model";

/** Результат проверки одним правилом (для UI). */
export interface RuleResult {
  rule: Rule;
  config: RuleConfig;
  violations: Violation[];
  error: string | null;
}

/** Запустить все правила профиля над документом. */
export function runProfile(
  profile: GostProfile,
  doc: ParsedDocument,
  overrides: Record<string, RuleConfig> = {},
): RuleResult[] {
  const results: RuleResult[] = [];
  for (const rule of profile.rules) {
    const config = { ...rule.defaultConfig, ...(overrides[rule.id] ?? {}) };
    let violations: Violation[] = [];
    let error: string | null = null;
    try {
      violations = rule.check(doc, config);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    results.push({ rule, config, violations, error });
  }
  return results;
}
