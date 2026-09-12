import type { GostProfile } from "../core/model";
import { gost210595 } from "./gost-2-105-95";

export const PROFILES: GostProfile[] = [gost210595];

export function profileById(id: string): GostProfile | undefined {
  return PROFILES.find((p) => p.id === id);
}
