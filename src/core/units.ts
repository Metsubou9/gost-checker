/** Перевод единиц OOXML в типографские единицы. */

/** Твипы (twips) в миллиметры. 1 twip = 1/1440 дюйма. */
export function twipsToMm(twips: number): number {
  return Math.round((twips / 1440) * 25.4 * 100) / 100;
}

/** Полупункты (w:sz в OOXML) в пункты. */
export function halfPointsToPt(halfPoints: number): number {
  return halfPoints / 2;
}

/** Восьмые доли пункта (w:szCs, интервалы) в пункты. */
export function eighthsToPt(eighths: number): number {
  return eighths / 8;
}

/** EMU (English Metric Units) в миллиметры. 1 EMU = 1/360000 мм. */
export function emuToMm(emu: number): number {
  return Math.round((emu / 360000) * 100) / 100;
}

/** Двадцатые доли пункта (w:spacing line для exact/atLeast) в пункты. */
export function twentiethsToPt(twentieths: number): number {
  return twentieths / 20;
}

/** Мм в твипы (обратное преобразование, для сравнения). */
export function mmToTwips(mm: number): number {
  return Math.round((mm / 25.4) * 1440);
}

/** Пункты в миллиметры (1 pt = 0.3528 мм). */
export function ptToMm(pt: number): number {
  return Math.round(pt * 0.352778 * 100) / 100;
}
