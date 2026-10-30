/**
 * Which sharks go in the water, shared by the terminal and the window/screensaver builds.
 * Entries are `kind` or `kind:shade`; `natural` keeps the species' own tint.
 */
import type { SharkKind, SharkSpec } from "./world";

/** Named grey levels (skin multipliers) for `kind:shade`. */
export const COLORS: Record<string, [number, number, number]> = {
  white: [1.2, 1.2, 1.2],
  light: [0.95, 0.95, 0.95],
  mid: [0.75, 0.75, 0.75],
  dark: [0.55, 0.55, 0.55],
  slate: [0.55, 0.62, 0.78],
};

/** Blue-grey: red and green held back, blue lifted, so the second batch reads as cool slate. */
const SLATE: [number, number, number] = [0.82, 0.92, 1.15];

/** Default lineup: all eight species, biggest first. */
export const ALL_SHARKS: SharkKind[] = ["greathammer", "thresher", "tiger", "hammerhead", "mako", "zebra", "classic", "nurse"];

/** Throws on an unknown shade so each caller can report it its own way. */
export function buildSpecs(entries?: string[]): SharkSpec[] {
  const kinds = entries ? entries.map((entry) => entry.split(":")[0] as SharkKind) : ALL_SHARKS;
  // Sizes step down from 1 to 0.55 across the lineup. Shades go in batches of four: the first
  // batch steps neutral greys from white to mid, the next steps darker blue-greys, and so on.
  const spread = (i: number, n: number) => (n > 1 ? i / (n - 1) : 0);
  const specs: SharkSpec[] = kinds.map((kind, i) => {
    const batch = Math.floor(i / 4);
    const inBatch = Math.min(4, kinds.length - batch * 4);
    const k = spread(i % 4, inBatch);
    const tint: [number, number, number] =
      batch % 2 === 0
        ? [1.2 - 0.45 * k, 1.2 - 0.45 * k, 1.2 - 0.45 * k]
        : (SLATE.map((c) => c * (0.8 - 0.3 * k)) as [number, number, number]);
    return { kind, size: 1 - 0.45 * spread(i, kinds.length), tint };
  });
  specs.forEach((spec, i) => {
    const color = entries?.[i].split(":")[1];
    if (!color) return;
    if (color === "natural") return void delete spec.tint;
    if (!COLORS[color]) {
      throw new Error(`Unknown shade "${color}". Try: ${Object.keys(COLORS).join(", ")}, natural`);
    }
    spec.tint = COLORS[color];
  });
  return specs;
}
