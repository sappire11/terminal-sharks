/**
 * The space scene's backdrop: everything the characters don't steer. Behind them, back to
 * front: a sky gradient that slowly shifts between dark palettes, a dithered nebula with the
 * Milky Way's glow, stars (some in clusters, some along the Milky Way, now and then one that
 * flares), planets with the odd moon, a rare slow comet, tumbling asteroids and shooting stars.
 * In front of them: a few specks of dust drifting past close up.
 *
 * Kept low-key so the characters stay the focus: the new layers are dark and faint, and only
 * the comet's head and a flaring star are allowed to be bright, and both are small.
 */
import { type PlanetSpec, paintAsteroid, randomPlanets } from "./bodies";
import { type Range, pick, rand, snap } from "./util";

/** Sky gradients (top, middle, bottom), all dark. The sky holds each, then blends into the next. */
const SKY_PALETTES: readonly (readonly [string, string, string])[] = [
  ["#05060f", "#0a0d24", "#141433"], // deep blue
  ["#0a0612", "#160c22", "#21142e"], // plum
  ["#040a0e", "#08151c", "#0f2229"], // ink green
];
const SKY_HOLD = 120;
const SKY_BLEND = 60;

/** Nebula: noise cells this many planet pixels across, in two colours, at three faint densities. */
const NEBULA_CELL = 2;
const NEBULA_COLORS = ["#4a2c66", "#22496a"];
const NEBULA_ALPHA = [0.08, 0.14, 0.2];
/** How much of the sky each cloud covers: noise below this shows nothing. */
const NEBULA_THRESHOLD = 0.52;
/** Milky Way: centre line at this fraction of the height, swinging this much, this wide. */
const MILKY_Y = 0.45;
const MILKY_SWING = 0.18;
const MILKY_WIDTH = 0.1;
const MILKY_COLOR = "#33386a";
/** Extra faint stars along the Milky Way, as a share of the ordinary star count. */
const MILKY_STARS = 0.8;

const STAR_COLORS = ["#ffffff", "#cfd8ff", "#fff1c9", "#bfc8ff"];
/** Leftward drift per star layer, CSS pixels per second: far stars barely move. */
const STAR_DRIFT = [1.5, 4, 8];
/** Share of near stars with a twinkling cross. */
const CROSS_SHARE = 0.15;
/** Small star clusters: how many, how many stars each, and their spread in CSS pixels. */
const CLUSTERS: Range = [3, 5.99];
const CLUSTER_SIZE: Range = [6, 12.99];
const CLUSTER_RADIUS = 40;
/** Every few seconds one star flares into a full cross and fades again. */
const PING_GAP: Range = [3, 6];
const PING_TIME = 0.6;

/** Seconds between shooting stars. */
const METEOR_GAP: Range = [8, 20];
/** A comet takes this long to cross, every few minutes; its ion tail is this long in CSS pixels. */
const COMET_GAP: Range = [150, 300];
const COMET_GAP_FAST: Range = [20, 30];
const COMET_CROSS: Range = [20, 30];
const COMET_TAIL = 260;
/** Asteroids: a new one every so often, at most a few at once, drifting in CSS pixels per second. */
const ASTEROID_GAP: Range = [15, 40];
const ASTEROID_GAP_FAST: Range = [4, 8];
const ASTEROID_MAX = 3;
const ASTEROID_SPEED: Range = [20, 40];
/** Seconds per tumble frame. */
const ASTEROID_TUMBLE: Range = [0.15, 0.3];
/** Dust in front of everyone: how many specks, how fast (CSS pixels per second), how faint. */
const DUST_COUNT: Range = [8, 12.99];
const DUST_SPEED: Range = [25, 45];
const DUST_ALPHA: Range = [0.25, 0.4];

interface Star {
  x: number;
  y: number;
  layer: number;
  big: boolean;
  cross: boolean;
  base: number;
  freq: number;
  phase: number;
  color: string;
}

interface Planet extends PlanetSpec {
  /** Top-left corner, device pixels. */
  x: number;
  y: number;
}

export interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export type Comet = Meteor;

export interface Asteroid {
  frames: HTMLCanvasElement[];
  /** Centre, device pixels. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  frame: number;
  frameIn: number;
  tumble: number;
  /** Whether a 航星者 has already had the chance to turn and look at it. */
  noticed: boolean;
}

interface Mote {
  x: number;
  y: number;
  /** Device pixels per second, leftward. */
  speed: number;
  alpha: number;
  phase: number;
}

export interface SkyOptions {
  /** Comets and asteroids every few seconds, for checking them. */
  fast?: boolean;
}

export class SpaceSky {
  /** Called when a shooting star or a comet appears, so the characters can look. */
  onMeteor: (() => void) | null = null;
  onComet: (() => void) | null = null;
  meteor: Meteor | null = null;
  comet: Comet | null = null;
  asteroids: Asteroid[] = [];

  private width = 0;
  private height = 0;
  private dpr = 1;
  private unit = 1;
  /** Starts somewhere random in the palette cycle, so each run opens on a different sky. */
  private time = rand([0, SKY_PALETTES.length * (SKY_HOLD + SKY_BLEND)]);
  /** The nebula canvas, one pixel per cell, and how far it has drifted. */
  private nebula!: HTMLCanvasElement;
  private nebulaShift = 0;
  /** Width everything far away wraps around at: the nebula's width, a hair over the screen's. */
  private wrapWidth = 0;
  private stars: Star[] = [];
  private ping: { star: Star; age: number } | null = null;
  private pingIn = rand(PING_GAP);
  private readonly planetSpecs = randomPlanets();
  private planets: Planet[] = [];
  private meteorIn = rand(METEOR_GAP);
  private cometIn: number;
  private asteroidIn: number;
  private dust: Mote[] = [];

  constructor(private readonly options: SkyOptions = {}) {
    this.cometIn = this.cometGap();
    this.asteroidIn = this.asteroidGap() * 0.5;
  }

  /** `unit` is 藍咩's pixel scale; stars, planets and dust are sized from it. */
  resize(width: number, height: number, dpr: number, unit: number) {
    const oldW = this.width;
    const oldH = this.height;
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.unit = unit;

    this.nebula = this.paintNebula();
    this.stars = this.makeStars();
    this.ping = null;

    if (this.planets.length === 0) {
      this.planets = this.planetSpecs.map((p) => ({ ...p, x: 0, y: 0 }));
      for (const p of this.planets) {
        const { w, h } = this.planetSize(p);
        p.x = p.fx * width - w / 2;
        p.y = p.fy * height - h / 2;
      }
    } else {
      for (const p of this.planets) {
        p.x *= width / oldW;
        p.y *= height / oldH;
      }
    }

    if (this.dust.length === 0) {
      this.dust = Array.from({ length: Math.floor(rand(DUST_COUNT)) }, () => ({
        x: Math.random() * width,
        y: rand([0.05, 0.95]) * height,
        speed: rand(DUST_SPEED),
        alpha: rand(DUST_ALPHA),
        phase: rand([0, Math.PI * 2]),
      }));
    } else {
      for (const m of this.dust) {
        m.x *= width / oldW;
        m.y *= height / oldH;
      }
    }
    for (const a of this.asteroids) {
      a.x *= width / oldW;
      a.y *= height / oldH;
    }
  }

  step(dt: number) {
    this.time += dt;
    const { dpr } = this;
    const W = this.wrapWidth;

    this.nebulaShift = (this.nebulaShift + STAR_DRIFT[0] * dpr * dt) % W;
    for (const s of this.stars) {
      s.x -= STAR_DRIFT[s.layer] * dpr * dt;
      if (s.x < 0) s.x += W;
    }
    this.stepPing(dt);

    for (const p of this.planets) {
      p.x -= p.drift * dpr * dt;
      const { w } = this.planetSize(p);
      if (p.x < -w * 1.5) p.x = this.width + w * 0.5;
    }

    for (const m of this.dust) {
      m.x -= m.speed * dpr * dt;
      if (m.x < -this.dustSize()) m.x += this.width + 2 * this.dustSize();
    }

    this.stepMeteor(dt);
    this.stepComet(dt);
    this.stepAsteroids(dt);
  }

  /** Everything behind the characters. */
  renderBack(ctx: CanvasRenderingContext2D) {
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    this.drawSky(ctx);
    this.drawNebula(ctx);
    this.drawStars(ctx);
    for (const p of this.planets) this.drawPlanet(ctx, p);
    this.drawComet(ctx);
    this.drawAsteroids(ctx);
    this.drawMeteor(ctx);
  }

  /** The dust that drifts past in front of the characters. */
  renderFront(ctx: CanvasRenderingContext2D) {
    const size = this.dustSize();
    ctx.fillStyle = "#dfe6ff";
    for (const m of this.dust) {
      ctx.globalAlpha = m.alpha;
      const bob = Math.sin(this.time * 0.5 + m.phase) * 6 * this.dpr;
      ctx.fillRect(snap(m.x, size), snap(m.y + bob, size), size, size);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- sizes

  /** Size of one star pixel. */
  private starUnit() {
    return Math.max(1, Math.round(this.unit / 3));
  }

  private planetUnit() {
    return Math.max(1, Math.round(this.unit * 0.5));
  }

  private dustSize() {
    return Math.max(2, Math.round(this.unit * 0.5));
  }

  private planetSize(p: PlanetSpec) {
    const u = this.planetUnit();
    return { w: p.sprite.width * u, h: p.sprite.height * u };
  }

  // ---------------------------------------------------------------- sky and nebula

  private drawSky(ctx: CanvasRenderingContext2D) {
    const cycle = SKY_HOLD + SKY_BLEND;
    const t = this.time % (cycle * SKY_PALETTES.length);
    const i = Math.floor(t / cycle);
    const into = t - i * cycle;
    const mix = into < SKY_HOLD ? 0 : smoothstep((into - SKY_HOLD) / SKY_BLEND);
    const from = SKY_PALETTES[i];
    const to = SKY_PALETTES[(i + 1) % SKY_PALETTES.length];
    const g = ctx.createLinearGradient(0, 0, 0, this.height);
    g.addColorStop(0, mixColor(from[0], to[0], mix));
    g.addColorStop(0.6, mixColor(from[1], to[1], mix));
    g.addColorStop(1, mixColor(from[2], to[2], mix));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  /** Device pixels per nebula cell. */
  private nebulaCell() {
    return this.planetUnit() * NEBULA_CELL;
  }

  /** Centre of the Milky Way at device x, in device pixels; repeats every wrapWidth. */
  private milkyCentre(x: number) {
    return this.height * (MILKY_Y + MILKY_SWING * Math.sin((2 * Math.PI * x) / this.wrapWidth));
  }

  /**
   * Two clouds and the Milky Way's glow, at one pixel per cell. Each is a density in 0–1 that
   * steps into three faint levels through a 4×4 Bayer matrix, so the edges dither like the
   * planets' shading. The noise wraps horizontally so the strip can scroll forever.
   */
  private paintNebula() {
    const cell = this.nebulaCell();
    const cols = Math.ceil(this.width / cell);
    const rows = Math.ceil(this.height / cell);
    this.wrapWidth = cols * cell;
    const canvas = document.createElement("canvas");
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext("2d")!;
    const aspect = rows / cols;
    const clouds = NEBULA_COLORS.map(() => fractalNoise(cols, rows, 3, Math.max(2, Math.round(3 * aspect))));
    const grain = fractalNoise(cols, rows, 8, Math.max(2, Math.round(8 * aspect)));
    const milkyWidth = (MILKY_WIDTH * this.height) / cell;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const dither = BAYER[y % 4][x % 4];
        let best = 0;
        let color = "";
        clouds.forEach((noise, i) => {
          const d = Math.max(0, (noise(x, y) - NEBULA_THRESHOLD) / (1 - NEBULA_THRESHOLD)) * 1.6;
          if (d > best) {
            best = d;
            color = NEBULA_COLORS[i];
          }
        });
        const off = (y - this.milkyCentre(x * cell) / cell) / milkyWidth;
        const milky = Math.exp(-off * off) * (0.45 + 0.55 * grain(x, y)) * 0.75;
        if (milky > best) {
          best = milky;
          color = MILKY_COLOR;
        }
        const level = Math.min(3, Math.floor(best * 3 + dither));
        if (level <= 0) continue;
        ctx.globalAlpha = NEBULA_ALPHA[level - 1];
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return canvas;
  }

  private drawNebula(ctx: CanvasRenderingContext2D) {
    const cell = this.nebulaCell();
    const w = this.nebula.width * cell;
    const h = this.nebula.height * cell;
    const x = -snap(this.nebulaShift, this.starUnit());
    ctx.drawImage(this.nebula, x, 0, w, h);
    ctx.drawImage(this.nebula, x + w, 0, w, h);
  }

  // ---------------------------------------------------------------- stars

  private makeStar(x: number, y: number, layer: number): Star {
    return {
      x,
      y,
      layer,
      big: layer === 2 && Math.random() < 0.5,
      cross: layer === 2 && Math.random() < CROSS_SHARE,
      base: layer === 0 ? rand([0.4, 0.7]) : rand([0.65, 1]),
      freq: rand([0.6, 3.5]),
      phase: rand([0, Math.PI * 2]),
      color: pick(STAR_COLORS),
    };
  }

  private makeStars(): Star[] {
    const W = this.wrapWidth;
    const cssArea = (this.width * this.height) / (this.dpr * this.dpr);
    const count = Math.round(cssArea / 3500);
    const stars: Star[] = [];
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      const layer = r < 0.55 ? 0 : r < 0.85 ? 1 : 2;
      stars.push(this.makeStar(Math.random() * W, Math.random() * this.height, layer));
    }

    // Small clusters, far or middle distance.
    const spread = CLUSTER_RADIUS * this.dpr;
    for (let c = Math.floor(rand(CLUSTERS)); c > 0; c--) {
      const cx = Math.random() * W;
      const cy = rand([0.1, 0.9]) * this.height;
      const layer = Math.random() < 0.6 ? 0 : 1;
      for (let n = Math.floor(rand(CLUSTER_SIZE)); n > 0; n--) {
        const a = rand([0, Math.PI * 2]);
        const d = Math.sqrt(Math.random()) * spread;
        stars.push(this.makeStar((cx + Math.cos(a) * d + W) % W, cy + Math.sin(a) * d, layer));
      }
    }

    // Faint stars along the Milky Way, thinning out away from its centre line.
    const width = MILKY_WIDTH * this.height;
    for (let n = Math.round(count * MILKY_STARS); n > 0; n--) {
      const x = Math.random() * W;
      const y = this.milkyCentre(x) + gaussian() * width * 0.7;
      if (y < 0 || y > this.height) continue;
      const s = this.makeStar(x, y, 0);
      s.base *= 0.7;
      stars.push(s);
    }
    return stars;
  }

  private stepPing(dt: number) {
    if (this.ping) {
      this.ping.age += dt;
      if (this.ping.age >= PING_TIME) this.ping = null;
      return;
    }
    this.pingIn -= dt;
    if (this.pingIn > 0) return;
    this.pingIn = rand(PING_GAP);
    const bright = this.stars.filter((s) => s.layer > 0 && s.x < this.width);
    if (bright.length) this.ping = { star: pick(bright), age: 0 };
  }

  private drawStars(ctx: CanvasRenderingContext2D) {
    const u = this.starUnit();
    for (const s of this.stars) {
      const twinkle = 0.6 + 0.4 * Math.sin(this.time * s.freq + s.phase);
      let alpha = s.base * twinkle;
      // How far the cross reaches, and how strong its arms are.
      let glow = s.cross ? twinkle : 0;
      let strength = s.base;
      if (this.ping?.star === s) {
        const flare = Math.sin((Math.PI * this.ping.age) / PING_TIME);
        alpha = Math.max(alpha, flare);
        glow = Math.max(glow, flare);
        strength = 1;
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color;
      const x = snap(s.x, u);
      const y = snap(s.y, u);
      if (glow > 0) {
        ctx.fillRect(x, y, u, u);
        // The arms come and go with the twinkle.
        if (glow > 0.55) {
          ctx.globalAlpha = strength * (glow - 0.4);
          ctx.fillRect(x - u, y, u, u);
          ctx.fillRect(x + u, y, u, u);
          ctx.fillRect(x, y - u, u, u);
          ctx.fillRect(x, y + u, u, u);
        }
        if (glow > 0.85) {
          ctx.fillRect(x - 2 * u, y, u, u);
          ctx.fillRect(x + 2 * u, y, u, u);
          ctx.fillRect(x, y - 2 * u, u, u);
          ctx.fillRect(x, y + 2 * u, u, u);
        }
      } else {
        const size = s.big ? 2 * u : u;
        ctx.fillRect(x, y, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- planets

  private drawPlanet(ctx: CanvasRenderingContext2D, p: Planet) {
    const u = this.planetUnit();
    const { w, h } = this.planetSize(p);
    const body = () => ctx.drawImage(p.sprite, snap(p.x, u), snap(p.y, u), w, h);
    const m = p.moon;
    if (!m) return body();

    // The moon passes behind the planet on the far half of its orbit.
    const a = m.phase + (2 * Math.PI * this.time) / m.period;
    const mw = m.sprite.width * u;
    const mh = m.sprite.height * u;
    const moon = () =>
      ctx.drawImage(
        m.sprite,
        snap(p.x + w / 2 + Math.cos(a) * m.rx * u - mw / 2, u),
        snap(p.y + h / 2 + Math.sin(a) * m.ry * u - mh / 2, u),
        mw,
        mh,
      );
    if (Math.sin(a) < 0) {
      moon();
      body();
    } else {
      body();
      moon();
    }
  }

  // ---------------------------------------------------------------- shooting stars and comets

  private stepMeteor(dt: number) {
    if (this.meteor) {
      const m = this.meteor;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const tail = this.meteorTail();
      if (m.x < -tail || m.y > this.height + tail || m.x > this.width + tail) this.meteor = null;
      return;
    }
    this.meteorIn -= dt;
    if (this.meteorIn > 0) return;
    this.meteorIn = rand(METEOR_GAP);
    const angle = rand([0.25, 0.55]);
    const speed = rand([700, 1000]) * this.dpr;
    const leftward = Math.random() < 0.7;
    this.meteor = {
      x: rand(leftward ? [0.3, 1.0] : [0, 0.7]) * this.width,
      y: rand([-0.05, 0.3]) * this.height,
      vx: Math.cos(angle) * speed * (leftward ? -1 : 1),
      vy: Math.sin(angle) * speed,
    };
    this.onMeteor?.();
  }

  private meteorTail() {
    return 160 * this.dpr;
  }

  private drawMeteor(ctx: CanvasRenderingContext2D) {
    const m = this.meteor;
    if (!m) return;
    const u = this.starUnit();
    const speed = Math.hypot(m.vx, m.vy);
    const dirX = m.vx / speed;
    const dirY = m.vy / speed;
    const steps = Math.ceil(this.meteorTail() / u);
    for (let k = steps; k >= 0; k--) {
      const fade = 1 - k / steps;
      ctx.globalAlpha = fade * fade;
      ctx.fillStyle = k < steps * 0.2 ? "#ffffff" : "#bcd2ff";
      ctx.fillRect(snap(m.x - dirX * k * u, u), snap(m.y - dirY * k * u, u), u, u);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(snap(m.x, u) - u / 2, snap(m.y, u) - u / 2, u * 2, u * 2);
  }

  private cometGap() {
    return rand(this.options.fast ? COMET_GAP_FAST : COMET_GAP);
  }

  private cometTail() {
    return COMET_TAIL * this.dpr;
  }

  private stepComet(dt: number) {
    const c = this.comet;
    if (c) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      const tail = this.cometTail();
      if (c.x < -tail || c.x > this.width + tail) this.comet = null;
      return;
    }
    this.cometIn -= dt;
    if (this.cometIn > 0) return;
    this.cometIn = this.cometGap();
    // A shallow line across the upper part of the sky, from one side to the other.
    const leftward = Math.random() < 0.5;
    const x0 = leftward ? this.width + 10 * this.dpr : -10 * this.dpr;
    const x1 = leftward ? -this.cometTail() : this.width + this.cometTail();
    const y0 = rand([0.08, 0.4]) * this.height;
    const y1 = y0 + rand([-0.1, 0.15]) * this.height;
    const time = rand(COMET_CROSS);
    this.comet = { x: x0, y: y0, vx: (x1 - x0) / time, vy: (y1 - y0) / time };
    this.onComet?.();
  }

  /**
   * A straight, pale blue ion tail and a shorter, warmer dust tail that curls off to one side
   * and breaks up toward its end. The head is a small white core with a faint cross of glow.
   */
  private drawComet(ctx: CanvasRenderingContext2D) {
    const c = this.comet;
    if (!c) return;
    const u = this.starUnit();
    const speed = Math.hypot(c.vx, c.vy);
    const dx = c.vx / speed;
    const dy = c.vy / speed;
    // Sideways, on the lower side of the path.
    const px = dx > 0 ? -dy : dy;
    const py = dx > 0 ? dx : -dx;

    const ion = Math.ceil(this.cometTail() / u);
    ctx.fillStyle = "#a9c6ff";
    for (let k = ion; k >= 2; k--) {
      const fade = 1 - k / ion;
      ctx.globalAlpha = 0.5 * fade ** 1.5;
      ctx.fillRect(snap(c.x - dx * k * u, u), snap(c.y - dy * k * u, u), u, u);
    }

    const dust = Math.ceil(ion * 0.65);
    const curl = this.cometTail() * 0.25;
    ctx.fillStyle = "#e9d8a6";
    for (let k = dust; k >= 2; k--) {
      const along = k / dust;
      if (along > 0.5 && k % 2) continue; // scattered toward the end
      ctx.globalAlpha = 0.35 * (1 - along) ** 2;
      const side = along * along * curl;
      ctx.fillRect(snap(c.x - dx * k * u + px * side, u), snap(c.y - dy * k * u + py * side, u), u, u);
    }

    const x = snap(c.x, u);
    const y = snap(c.y, u);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#cfe0ff";
    ctx.fillRect(x - 2 * u, y, u, u);
    ctx.fillRect(x + 2 * u, y, u, u);
    ctx.fillRect(x, y - 2 * u, u, u);
    ctx.fillRect(x, y + 2 * u, u, u);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - u / 2, y - u / 2, 2 * u, 2 * u);
  }

  // ---------------------------------------------------------------- asteroids

  private asteroidGap() {
    return rand(this.options.fast ? ASTEROID_GAP_FAST : ASTEROID_GAP);
  }

  private stepAsteroids(dt: number) {
    const u = this.planetUnit();
    for (const a of this.asteroids) {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.frameIn -= dt;
      if (a.frameIn <= 0) {
        a.frameIn = a.tumble;
        a.frame = (a.frame + 1) % a.frames.length;
      }
    }
    this.asteroids = this.asteroids.filter((a) => {
      const r = a.frames[0].width * u;
      return a.x > -r && a.x < this.width + r && a.y > -r && a.y < this.height + r;
    });

    this.asteroidIn -= dt;
    if (this.asteroidIn > 0) return;
    this.asteroidIn = this.asteroidGap();
    if (this.asteroids.length >= ASTEROID_MAX) return;
    const frames = paintAsteroid();
    // Some tumble the other way.
    if (Math.random() < 0.5) frames.reverse();
    const r = (frames[0].width * u) / 2;
    const leftward = Math.random() < 0.5;
    const speed = rand(ASTEROID_SPEED) * this.dpr;
    this.asteroids.push({
      frames,
      x: leftward ? this.width + r : -r,
      y: rand([0.1, 0.9]) * this.height,
      vx: leftward ? -speed : speed,
      vy: speed * rand([-0.25, 0.25]),
      frame: Math.floor(rand([0, frames.length])),
      frameIn: 0,
      tumble: rand(ASTEROID_TUMBLE),
      noticed: false,
    });
  }

  private drawAsteroids(ctx: CanvasRenderingContext2D) {
    const u = this.planetUnit();
    for (const a of this.asteroids) {
      const sprite = a.frames[a.frame];
      const w = sprite.width * u;
      const h = sprite.height * u;
      ctx.drawImage(sprite, snap(a.x - w / 2, u), snap(a.y - h / 2, u), w, h);
    }
  }
}

/** 4×4 ordered-dither thresholds in [0, 1). */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => v / 16));

/**
 * Value noise over a `width × height` grid that wraps horizontally: three octaves, starting
 * from `cellsX × cellsY` lattice cells, smoothly interpolated. Returns values in about 0–1.
 */
function fractalNoise(width: number, height: number, cellsX: number, cellsY: number) {
  const octaves = [0, 1, 2].map((o) => {
    const nx = cellsX << o;
    const ny = (cellsY << o) + 1;
    const lattice = Array.from({ length: nx * (ny + 1) }, () => Math.random());
    return (x: number, y: number) => {
      const u = (x / width) * nx;
      const v = (y / height) * (ny - 1);
      const i = Math.floor(u);
      const j = Math.floor(v);
      const fu = smoothstep(u - i);
      const fv = smoothstep(v - j);
      const at = (a: number, b: number) => lattice[(((a % nx) + nx) % nx) + b * nx];
      const top = at(i, j) + (at(i + 1, j) - at(i, j)) * fu;
      const bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fu;
      return top + (bottom - top) * fv;
    };
  });
  return (x: number, y: number) => (octaves[0](x, y) * 4 + octaves[1](x, y) * 2 + octaves[2](x, y)) / 7;
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

/** A standard normal sample. */
function gaussian() {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

/** Blends two `#rrggbb` colours. */
function mixColor(a: string, b: string, t: number) {
  const ca = parseInt(a.slice(1), 16);
  const cb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const x = (ca >> shift) & 255;
    const y = (cb >> shift) & 255;
    return Math.round(x + (y - x) * t);
  };
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}
