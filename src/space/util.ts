/** Small helpers shared by the space scene's characters and backdrop. */

export type Range = [number, number];

export const rand = ([a, b]: Range) => a + Math.random() * (b - a);

export const pick = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

/** Rounds to the nearest multiple of `unit`, so a sprite lands on its own pixel grid. */
export function snap(v: number, unit: number) {
  return Math.round(v / unit) * unit;
}
