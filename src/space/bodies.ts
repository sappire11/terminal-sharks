/**
 * Pixel bodies for the space backdrop: planets (made up fresh each run), their small moons,
 * and tumbling asteroids. Everything is painted once at one pixel per canvas pixel and
 * scaled up with smoothing off, like the character sprites.
 */
import { type Range, pick, rand } from "./util";

/** Four tones each, highlight to deepest shadow; muted so planets stay behind the characters. */
const PLANET_TONES: readonly (readonly [string, string, string, string])[] = [
  ["#f4c6a8", "#d98a7a", "#9c5a6e", "#5a3756"], // peach to mauve
  ["#9fe3d6", "#4fa8a8", "#2f6f80", "#1f4058"], // teal
  ["#c9c0ea", "#8f84c4", "#5e5592", "#3a3461"], // lavender
  ["#e6c98f", "#b98a56", "#7d5640", "#4a3330"], // ochre
  ["#a9c4e0", "#6c8db8", "#465f8a", "#2b3a5c"], // slate blue
  ["#c4d6b0", "#86a07c", "#566e5a", "#344440"], // sage
];
const RING_TONES: readonly (readonly [string, string])[] = [
  ["#ecdcb6", "#a8907a"],
  ["#c9d3e8", "#7f8bab"],
  ["#e8c6d6", "#a67f95"],
];
const MOON_TONES = ["#d8d4cc", "#aaa59c", "#78736d", "#4c4846"] as const;
const ASTEROID_TONES = ["#8f857e", "#6a615c", "#48403f", "#2d282c"] as const;

const PLANET_COUNT: Range = [1, 3.99];
const PLANET_RADIUS: Range = [6, 16];
const RING_CHANCE = 0.4;
const BANDS_CHANCE = 0.5;
const MOON_CHANCE = 0.3;
const MOON_PERIOD: Range = [40, 70];
/** Planets keep at least this fraction of the screen width apart. */
const PLANET_SPACING = 0.3;

export interface Moon {
  sprite: HTMLCanvasElement;
  /** Orbit half-axes in planet pixels, around the planet's centre. */
  rx: number;
  ry: number;
  /** Seconds per orbit, and where on it the moon starts. */
  period: number;
  phase: number;
}

export interface PlanetSpec {
  sprite: HTMLCanvasElement;
  /** Centre, as fractions of the screen. */
  fx: number;
  fy: number;
  /** CSS pixels per second, leftward. */
  drift: number;
  moon: Moon | null;
}

/**
 * One to three planets with random size, colours, rings and stripes, spread apart: never two
 * close together across the width, each in the band above or below where the characters mostly
 * drift. Planets sharing a band drift at the same speed, so they never slide over each other.
 */
export function randomPlanets(): PlanetSpec[] {
  const count = Math.floor(rand(PLANET_COUNT));
  const tones = [...PLANET_TONES].sort(() => Math.random() - 0.5);
  const planets: PlanetSpec[] = [];
  const bandDrift: Record<string, number> = {};
  for (let i = 0; i < count; i++) {
    const r = Math.round(rand(PLANET_RADIUS));
    const ring = r >= 10 && Math.random() < RING_CHANCE ? pick(RING_TONES) : undefined;
    const sprite = paintPlanet(r, tones[i], { ring, bands: Math.random() < BANDS_CHANCE });

    let fx = rand([0.05, 0.95]);
    for (let tries = 0; tries < 30 && planets.some((p) => wrapGap(p.fx, fx) < PLANET_SPACING); tries++) {
      fx = rand([0.05, 0.95]);
    }
    const band = Math.random() < 0.5 ? "top" : "bottom";
    const fy = band === "top" ? rand([0.12, 0.35]) : rand([0.65, 0.85]);
    // Bigger looks nearer, so it drifts a little faster; the first one in a band sets its pace.
    bandDrift[band] ??= 1.2 + r * 0.08;

    let moon: Moon | null = null;
    if (Math.random() < MOON_CHANCE && !planets.some((p) => p.moon)) {
      const rx = Math.max(ring ? Math.round(r * 1.8) + 4 : 0, Math.round(r * 2.2));
      moon = {
        sprite: paintPlanet(Math.round(rand([2, 3.99])), MOON_TONES, {}),
        rx,
        ry: Math.round(rx * 0.35),
        period: rand(MOON_PERIOD),
        phase: rand([0, Math.PI * 2]),
      };
    }
    planets.push({ sprite, fx, fy, drift: bandDrift[band], moon });
  }
  return planets;
}

/** Distance between two fractions of the width, the short way round. */
function wrapGap(a: number, b: number) {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

/**
 * A pixel planet `r` pixels in radius at one pixel per canvas pixel, lit from the upper left.
 * `tones` runs from highlight to deepest shadow; neighbouring tones are checker-dithered where
 * they meet. An optional ring is split so its back half hides behind the planet.
 */
export function paintPlanet(
  r: number,
  tones: readonly [string, string, string, string],
  opts: { ring?: readonly [string, string]; bands?: boolean },
): HTMLCanvasElement {
  const ringRx = opts.ring ? Math.round(r * 1.8) : r;
  const ringRy = Math.round(r * 0.42);
  const w = 2 * ringRx + 2;
  const h = 2 * r + 2;
  const cx = w / 2;
  const cy = h / 2;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const light = normalize(-0.55, -0.6, 0.58);
  const thresholds = [0.72, 0.38, 0.05];

  const ring = (front: boolean) => {
    if (!opts.ring) return;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dy >= 0 !== front) continue;
        const e = (dx / ringRx) ** 2 + (dy / ringRy) ** 2;
        if (e > 1 || e < 0.62) continue;
        ctx.fillStyle = e > 0.82 ? opts.ring[1] : opts.ring[0];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  };

  ring(false);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - cx) / r;
      const ny = (y + 0.5 - cy) / r;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      let lum = nx * light[0] + ny * light[1] + nz * light[2];
      // Gas-giant stripes: darken a few latitudes a little.
      if (opts.bands && Math.sin(ny * 7.5 + 0.6) > 0.55) lum -= 0.18;
      let tone = thresholds.findIndex((t) => lum > t);
      if (tone < 0) tone = 3;
      // Dither the boundary into the next tone on a checkerboard.
      const t = thresholds[Math.min(tone, 2)];
      if (tone < 3 && lum - t < 0.06 && (x + y) % 2) tone++;
      ctx.fillStyle = tones[tone];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ring(true);
  return canvas;
}

/**
 * A lumpy asteroid as `frames` tumble frames. Each frame recomputes the pixels for the shape
 * turned a little further, rather than rotating an image, so the pixels stay square; the light
 * stays fixed at the upper left while the outline and craters turn.
 */
export function paintAsteroid(frames = 8): HTMLCanvasElement[] {
  const radius = rand([2.5, 4.5]);
  const lumps = [2, 3, 5].map((k, i) => ({ k, amp: [0.15, 0.1, 0.06][i] * rand([0.6, 1.2]), phase: rand([0, Math.PI * 2]) }));
  const craters = Array.from({ length: Math.random() < 0.5 ? 1 : 2 }, () => ({
    rho: rand([0.2, 0.55]) * radius,
    theta: rand([0, Math.PI * 2]),
    r: rand([0.7, 1.1]),
  }));
  const edge = (theta: number) => radius * (1 + lumps.reduce((s, l) => s + l.amp * Math.cos(l.k * theta + l.phase), 0));
  const size = Math.ceil(radius * 1.4) * 2 + 1;
  const c = size / 2;
  const light = normalize(-0.6, -0.65, 0.5);

  return Array.from({ length: frames }, (_, f) => {
    const turn = (f / frames) * Math.PI * 2;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x + 0.5 - c;
        const dy = y + 0.5 - c;
        const d = Math.hypot(dx, dy);
        const outline = edge(Math.atan2(dy, dx) - turn);
        if (d > outline) continue;
        // Shade it like a squashed sphere fitted to the local outline.
        const nx = dx / outline;
        const ny = dy / outline;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const lum = nx * light[0] + ny * light[1] + nz * light[2];
        let tone = lum > 0.65 ? 0 : lum > 0.3 ? 1 : lum > -0.05 ? 2 : 3;
        for (const cr of craters) {
          const cx = Math.cos(cr.theta + turn) * cr.rho;
          const cy = Math.sin(cr.theta + turn) * cr.rho;
          if (Math.hypot(dx - cx, dy - cy) < cr.r) tone = Math.min(3, tone + 1);
        }
        ctx.fillStyle = ASTEROID_TONES[tone];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return canvas;
  });
}

function normalize(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}
