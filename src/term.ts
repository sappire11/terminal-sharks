/**
 * Terminal port: runs the unchanged World + AsciiRenderer, but hands the renderer a fake
 * 2D context that records each cell's glyph / colours instead of drawing pixels. Every
 * frame is then flushed to the terminal as 24-bit ANSI colour.
 *
 *   npx tsx src/term.ts [classic,hammerhead:dark,tiger:natural,...]
 *   q / Esc / Ctrl-C to quit; the mouse lures fish, a click splashes.
 */
import { AsciiRenderer } from "./renderer";
import { World, type SharkKind, type SharkSpec } from "./world";

// Terminal cells are roughly twice as tall as wide; the world is laid out in these "pixels".
const CW = 10;
const CH = 20;
const STEP = 1 / 60;
const FPS = 60;

type RGB = [number, number, number];

/** Parses the handful of colour formats the renderer emits: #rrggbb, rgb(), rgba(). */
function parseColor(s: string): [RGB, number] {
  if (s[0] === "#") {
    const v = parseInt(s.slice(1), 16);
    return [[(v >> 16) & 255, (v >> 8) & 255, v & 255], 1];
  }
  const p = s.slice(s.indexOf("(") + 1, -1).split(",").map(Number);
  return [[p[0], p[1], p[2]], p.length > 3 ? p[3] : 1];
}

/** Blends `over` onto a packed 0xRRGGBB colour and returns it packed. */
function blend(under: number, over: RGB, a: number) {
  const r = (under >> 16) & 255;
  const g = (under >> 8) & 255;
  const b = under & 255;
  return (
    (Math.round(r + (over[0] - r) * a) << 16) |
    (Math.round(g + (over[1] - g) * a) << 8) |
    Math.round(b + (over[2] - b) * a)
  );
}

/** One frame of terminal cells, plus what the terminal showed last frame. Colours are 0xRRGGBB. */
class CellBuffer {
  cols = 0;
  rows = 0;
  glyph: string[] = [];
  fg = new Int32Array(0);
  bg = new Int32Array(0);
  shownGlyph: string[] = [];
  shownFg = new Int32Array(0);
  shownBg = new Int32Array(0);
  /** Set when the terminal's contents are unknown (start, resize): redraw every cell. */
  stale = true;

  resize(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    const n = cols * rows;
    this.fg = new Int32Array(n);
    this.bg = new Int32Array(n);
    this.shownGlyph = new Array(n).fill(" ");
    this.shownFg = new Int32Array(n);
    this.shownBg = new Int32Array(n);
    this.stale = true;
    this.clear();
  }

  clear() {
    this.glyph = new Array(this.cols * this.rows).fill(" ");
    this.fg.fill(0);
    this.bg.fill(0);
  }

  index(x: number, y: number) {
    const c = Math.floor(x / CW);
    const r = Math.floor(y / CH);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }
}

/** Just enough of CanvasRenderingContext2D for AsciiRenderer, writing into a CellBuffer. */
function recordingContext(buf: CellBuffer) {
  let fill: RGB = [255, 255, 255];
  let alpha = 1;
  return {
    font: "",
    textAlign: "center",
    textBaseline: "middle",
    set fillStyle(s: string) {
      [fill, alpha] = parseColor(s);
    },
    setTransform() {},
    // The only image drawn is the black grid backdrop: start the frame fresh.
    drawImage() {
      buf.clear();
    },
    fillRect(x: number, y: number, w: number, h: number) {
      const i = buf.index(x + w / 2, y + h / 2);
      if (i < 0) return;
      if (w >= CW * 0.5) {
        // Shark skin block: becomes the cell background.
        buf.bg[i] = blend(buf.bg[i], fill, alpha);
      } else {
        // Tiny wake dot: a terminal can't draw sub-cell squares, so use a glyph.
        buf.glyph[i] = "·";
        buf.fg[i] = blend(buf.bg[i], fill, alpha);
      }
    },
    fillText(text: string, x: number, y: number) {
      const i = buf.index(x, y);
      if (i < 0) return;
      buf.glyph[i] = text;
      buf.fg[i] = blend(buf.bg[i], fill, alpha);
    },
  };
}

// The renderer creates an offscreen canvas for its backdrop; give it a harmless stand-in.
(globalThis as any).document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ({ setTransform() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} }) }),
};

const buf = new CellBuffer();
const canvas = { width: 0, height: 0, getContext: () => recordingContext(buf) };
const renderer = new AsciiRenderer(canvas as unknown as HTMLCanvasElement);
// Character cells blow up girth more than length at large sizes; draw the sharks leaner.
renderer.slenderness = 0.9;

/** Named grey levels (skin multipliers) for `kind:shade` on the command line. */
const COLORS: Record<string, [number, number, number]> = {
  white: [1.2, 1.2, 1.2],
  light: [0.95, 0.95, 0.95],
  mid: [0.75, 0.75, 0.75],
  dark: [0.55, 0.55, 0.55],
  slate: [0.55, 0.62, 0.78],
};

/** Blue-grey: red and green held back, blue lifted, so the second batch reads as cool slate. */
const SLATE: [number, number, number] = [0.82, 0.92, 1.15];

/** Default lineup: all eight species, biggest first. */
const TERMINAL_SHARKS: SharkKind[] = ["greathammer", "thresher", "tiger", "hammerhead", "mako", "zebra", "classic", "nurse"];

// Each argument entry is `kind` or `kind:shade`; `natural` keeps the species' own tint.
const entries = process.argv[2]?.split(",").filter(Boolean);
const kinds = entries ? entries.map((entry) => entry.split(":")[0] as SharkKind) : TERMINAL_SHARKS;
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
    console.error(`Unknown shade "${color}". Try: ${Object.keys(COLORS).join(", ")}, natural`);
    process.exit(1);
  }
  spec.tint = COLORS[color];
});
const world = new World(specs);
world.maxSharkLength = Infinity;

const out = process.stdout;

function resize() {
  const cols = out.columns || 80;
  const rows = out.rows || 24;
  buf.resize(cols, rows);
  renderer.resize(cols * CW, rows * CH, 1, [CW, CH]);
  world.resize(cols * CW, rows * CH, CW, CH);
}

const rgb = (v: number) => `${(v >> 16) & 255};${(v >> 8) & 255};${v & 255}`;

/**
 * Writes only the cells that changed since the last frame; most of the ocean is black and
 * stays black, so this cuts the output (and the terminal's parsing work) by an order of magnitude.
 */
function flush() {
  const { cols, glyph, fg, bg, shownGlyph, shownFg, shownBg, stale } = buf;
  // Synchronized update: the terminal shows the frame only once it's complete, so no tearing.
  let s = "\x1b[?2026h";
  let cursor = -1;
  let penFg = -1;
  let penBg = -1;
  for (let i = 0; i < glyph.length; i++) {
    const g = glyph[i];
    // A blank cell's foreground is invisible, so it never counts as a change.
    const f = g === " " ? -1 : fg[i];
    const b = bg[i];
    if (!stale && g === shownGlyph[i] && f === shownFg[i] && b === shownBg[i]) continue;
    shownGlyph[i] = g;
    shownFg[i] = f;
    shownBg[i] = b;

    const c = i % cols;
    if (cursor !== i) s += `\x1b[${((i / cols) | 0) + 1};${c + 1}H`;
    const sgr: string[] = [];
    if (f !== -1 && f !== penFg) sgr.push(`38;2;${rgb(f)}`), (penFg = f);
    if (b !== penBg) sgr.push(`48;2;${rgb(b)}`), (penBg = b);
    if (sgr.length) s += `\x1b[${sgr.join(";")}m`;
    s += g;
    // After the last column the cursor's position is terminal-specific; re-address next time.
    cursor = c === cols - 1 ? -1 : i + 1;
  }
  buf.stale = false;
  out.write(s + "\x1b[?2026l");
}

let last = performance.now();
function frame() {
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  // Node timers drift around 1/60 s, so a fixed-step accumulator would hand frames 0 or 2
  // steps and the motion would judder. Advance by the real elapsed time instead, in equal
  // substeps no longer than STEP.
  const steps = Math.max(1, Math.ceil(dt / STEP - 0.01));
  for (let k = 0; k < steps; k++) world.step(dt / steps);
  renderer.render(world, dt);
  // If the terminal hasn't drained the last frame, skip this one rather than queue up lag.
  if (!out.writableNeedDrain) flush();
}

/** SGR mouse reports: ESC [ < button ; col ; row (M = press/move, m = release). */
function onInput(data: Buffer) {
  const str = data.toString();
  if (str === "q" || str === "\x03" || str === "\x1b") return quit();
  for (const m of str.matchAll(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/g)) {
    const button = Number(m[1]);
    const x = (Number(m[2]) - 0.5) * CW;
    const y = (Number(m[3]) - 0.5) * CH;
    world.pointer.x = x;
    world.pointer.y = y;
    world.pointer.active = true;
    if (m[4] === "M" && (button & 32) === 0 && (button & 3) === 0) world.splash(x, y);
  }
}

let timer: NodeJS.Timeout;
function quit() {
  clearInterval(timer);
  out.write("\x1b[?1003l\x1b[?1006l\x1b[0m\x1b[?25h\x1b[?1049l");
  process.exit(0);
}

if (!out.isTTY) {
  console.error("terminal-sharks needs an interactive terminal.");
  process.exit(1);
}
// Alternate screen, hidden cursor, any-motion mouse tracking in SGR mode.
out.write("\x1b[?1049h\x1b[?25l\x1b[?1003h\x1b[?1006h\x1b[2J");
process.stdin.setRawMode(true);
process.stdin.on("data", onInput);
out.on("resize", resize);
process.on("SIGINT", quit);
process.on("SIGTERM", quit);

resize();
timer = setInterval(frame, 1000 / FPS);
