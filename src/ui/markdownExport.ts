import type { GostProfile } from "../core/model";
import type { RuleResult } from "../rules/engine";

const SEV_RU: Record<string, string> = {
  error: "Ошибка",
  warning: "Предупреждение",
  info: "Замечание",
};

export function toMarkdown(fileName: string, profile: GostProfile, results: RuleResult[]): string {
  const lines: string[] = [];
  const all = results.flatMap((r) => r.violations);
  const counts = {
    error: all.filter((v) => v.severity === "error").length,
    warning: all.filter((v) => v.severity === "warning").length,
    info: all.filter((v) => v.severity === "info").length,
  };

  lines.push(`# Отчёт GOST Checker`);
  lines.push("");
  lines.push(`- **Файл:** ${fileName}`);
  lines.push(`- **Профиль:** ${profile.name}`);
  lines.push(`- **Дата:** ${new Date().toLocaleString("ru-RU")}`);
  lines.push(
    `- **Итог:** ошибок — ${counts.error}, предупреждений — ${counts.warning}, замечаний — ${counts.info}`,
  );
  lines.push("");

  const active = results.filter((r) => r.violations.length > 0 || r.error);
  if (active.length === 0) {
    lines.push("Нарушений не найдено.");
    lines.push("");
  }

  for (const { rule, violations, error } of active) {
    lines.push(`## ${rule.title}`);
    lines.push(`*${rule.gostClause} · уровень: ${SEV_RU[rule.severity] ?? rule.severity}*`);
    lines.push("");
    if (error) {
      lines.push(`> Правило не выполнено: ${error}`);
      lines.push("");
    }
    for (const v of violations) {
      lines.push(`- **${SEV_RU[v.severity]}** (${v.location}): ${v.message}`);
      if (v.excerpt) lines.push(`  - фрагмент: «${v.excerpt}»`);
      if (v.suggestion) lines.push(`  - как исправить: ${v.suggestion}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
