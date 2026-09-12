import type { Rule } from "../core/model";
import { pageA4, pageMargins, pageNumbers } from "./page";
import { fontFamilyRule, fontSizeRule } from "./font";
import { lineSpacingRule, indentRule, alignmentRule, colorRule } from "./paragraph-format";
import {
  headingCaseRule,
  headingTrailingDotRule,
  headingUnderlineRule,
  headingHyphensRule,
  headingNumberingRule,
  headingSpacingRule,
  sectionNewPageRule,
  tocPresentRule,
} from "./structure";
import { tableCaptionRule, figureCaptionRule } from "./tables-figures";
import { referencesPresentRule, referencesNumberingRule, referencesPatternRule } from "./references";

// Реэкспорт правил для профилей и тестов
export {
  pageA4,
  pageMargins,
  pageNumbers,
  fontFamilyRule,
  fontSizeRule,
  lineSpacingRule,
  indentRule,
  alignmentRule,
  colorRule,
  headingCaseRule,
  headingTrailingDotRule,
  headingUnderlineRule,
  headingHyphensRule,
  headingNumberingRule,
  headingSpacingRule,
  sectionNewPageRule,
  tocPresentRule,
  tableCaptionRule,
  figureCaptionRule,
  referencesPresentRule,
  referencesNumberingRule,
  referencesPatternRule,
};

/** Все правила, доступные профилям. */
export const ALL_RULES: Rule[] = [
  pageA4,
  pageMargins,
  pageNumbers,
  fontFamilyRule,
  fontSizeRule,
  lineSpacingRule,
  indentRule,
  alignmentRule,
  colorRule,
  headingCaseRule,
  headingTrailingDotRule,
  headingUnderlineRule,
  headingHyphensRule,
  headingNumberingRule,
  headingSpacingRule,
  sectionNewPageRule,
  tocPresentRule,
  tableCaptionRule,
  figureCaptionRule,
  referencesPresentRule,
  referencesNumberingRule,
  referencesPatternRule,
];

export function ruleById(id: string): Rule | undefined {
  return ALL_RULES.find((r) => r.id === id);
}
