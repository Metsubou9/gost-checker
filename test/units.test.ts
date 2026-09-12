import { describe, expect, it } from "vitest";
import { emuToMm, halfPointsToPt, mmToTwips, ptToMm, twipsToMm } from "../src/core/units";

describe("units", () => {
  it("twips→mm", () => {
    expect(twipsToMm(1701)).toBeCloseTo(30.01, 1); // 3 см
    expect(twipsToMm(1134)).toBeCloseTo(20.0, 0); // 2 см
  });
  it("mm→twips roundtrip", () => {
    expect(mmToTwips(25.4)).toBe(1440);
  });
  it("half-points→pt", () => {
    expect(halfPointsToPt(28)).toBe(14);
  });
  it("EMU→mm", () => {
    expect(emuToMm(360000)).toBe(1);
    expect(emuToMm(9144000)).toBeCloseTo(25.4, 1); // 1 дюйм
  });
  it("pt→mm", () => {
    expect(ptToMm(28.35)).toBeCloseTo(10, 0);
  });
});
