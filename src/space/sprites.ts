/**
 * Pixel sprites for the space scene, drawn as palette-letter grids: one string per row,
 * one letter per pixel, "." transparent. Both characters face right; the scene mirrors them.
 * Edit the letters to change a pose or an expression. Nothing here touches the DOM until
 * buildSprite() is called, so the grids can also be imported from Node for previews.
 */

export const PALETTE: Record<string, string> = {
  // 藍咩
  l: "#c7c1ef", // body
  L: "#e6e3fb", // body highlight
  m: "#a59edb", // body shade
  k: "#6f68ad", // body outline
  h: "#232229", // beaked mask
  H: "#3d3c47", // mask highlight
  K: "#4d4c5a", // mask rim, so the black mask still reads against the night sky
  g: "#7c7b86", // mask eye
  G: "#a7a6b1", // mask eye highlight
  e: "#17161c", // eyes and mouth
  // 航星者
  n: "#4a4962", // body
  o: "#1c2340", // outline, beak edges, arm stroke
  c: "#45445c", // cap
  C: "#5a5973", // cap highlight
  s: "#5b54b8", // cap band
  S: "#918ae3", // cap band stripes
  y: "#f1df9a", // goggle rims, cap ring
  Y: "#d6bd6a", // goggle rims, lower half
  d: "#5d55c0", // lens
  v: "#a49df0", // lens glint
  B: "#5c5b78", // beak, a shade lighter than the body so it reads
  t: "#f1d27a", // gold: beak dots and tip, dangling dots, feet
  r: "#ec8fb0", // blush
  w: "#5f56ad", // hem
  // unicorn horn
  q: "#d8a86a", // edge
  u: "#fff3dc", // horn
  U: "#ef9fc4", // spiral groove
  // speech bubbles: body outline k, letters e
  b: "#f4f2ff", // bubble
};

/** Replaces whole rows of a grid: `patch(grid, { 17: "...", 18: "..." })`. */
function patch(rows: readonly string[], changes: Record<number, string>): string[] {
  return rows.map((row, i) => changes[i] ?? row);
}

// 30 × 25: a round body with a beaked mask pushed up over the upper left
export const BLUEME_OPEN: readonly string[] = [
  "...........kkkkkkkkkk.........",
  "....KKKKKKkllllllllllkk.......",
  ".KKKKhhhggKllllllllllllk......",
  "KhhhhhhgGggKllllllllllllkk....",
  ".KKKhhhggggKllllllllllLLLk....",
  "...KhhhhgghhKlllllllLLLLllk...",
  "..KhhhhhhhhhKlllllllLLlllllk..",
  "..KhhhhhhhhhKllllllllllllllk..",
  "..KhhhhhhhhKllllllllllllllllk.",
  "..KHHHHhhhhKllllllllllllllllk.",
  "..kKHHhhhhKlllllllllllllllllk.",
  "..klKKKKKKllllllllllllllllllk.",
  "..klllllllllllllllllllllllllk.",
  "..klllllllllllelllllelllllllk.",
  "..klllllllllllellellelllllllk.",
  "...kmmllllllllllllllllllllmmk.",
  "...kmmlllllllllllllllllllmmmk.",
  "...kmmmllllllllllllllllllmmk..",
  "....kmmmllllllllllllllllmmmk..",
  ".....kmmmllllllllllllllmmmk...",
  ".....kkmmmllllllllllllmmmk....",
  ".......kmmmmlllllllmmmmmk.....",
  "........kkmmmmmmmmmmmmkk......",
  "..........kkmmmmmmmkkk........",
  "............kkkkkkk...........",
];

/** Eyes shut: each tall eye becomes a short line on its lower row. */
export const BLUEME_CLOSED = patch(BLUEME_OPEN, {
  13: "..klllllllllllllllllllllllllk.",
  14: "..klllllllllleellelleellllllk.",
});

/**
 * Taller and shorter versions for a hop, with her usual face: rows 12 (between the mask and the
 * eyes) and 19 (the lower body) are plain body, so doubling or dropping them stretches or
 * squashes the shape without touching the face, and the pixels stay square.
 */
const SQUISH_ROWS = [12, 19];
export const BLUEME_TALL = BLUEME_OPEN.flatMap((row, i) => (SQUISH_ROWS.includes(i) ? [row, row] : [row]));
export const BLUEME_SHORT = BLUEME_OPEN.filter((_, i) => !SQUISH_ROWS.includes(i));

// 28 × 31. The original faces left; this is mirrored. A peaked cap: a wide flat crown, the visor
// shorter than it at the back and jutting out at the front, a gold ring and chain where they meet.
// Goggles without a bridge, the far lens a pixel narrower; a corn-cob beak with gold kernels.
export const VOYAGER_A: readonly string[] = [
  "......oooooooooooooooo......",
  "...ooccCCCCCcccccccccccoo...",
  "..ocCCccccccccccccccccccco..",
  "..occcccccccccccccccccccco..",
  "...ooyooooooooooooooooooo...",
  "...oynosssssSSsssssSSsssso..",
  "...onynosssssSSsssssSSsssso.",
  "...onnnnosssssSSsssssSSsssso",
  "...onnntnoooooooooooooooooo.",
  "...onnnnntntnnnnnnnnnnno....",
  "...onnnyyyynnnnnnyyynnno....",
  "...onnyddddynnnnydddynno....",
  "...onyddddvdynnydddvdyno....",
  "...onydddvddynnyddvddyno....",
  "...onYddvdddYnnYdvdddYno....",
  "...onYdvddddYnnYdddddYno....",
  "...onnYddddYnnnnYdddYnno....",
  "...onnnYYYYnnnnnnYYYnnno....",
  "...onnrrrnnnnoototototototot",
  "...onnnnnnnnnoBBBBBBBBBBBtt.",
  "..onnnnnnonnnoBBBBBBBBooo...",
  "..onnnnnnonnnoBBBBBooonno...",
  "..onnnonnonnnnooooonnnnno...",
  "..onnnnoonnnnnnnnnnnnnnno...",
  "..onnnnnnnnnnnnnnnnnnnnno...",
  "..onnnnnnnnnnnnnnnnnnnnno...",
  "..wwwwwwwwwwwwwwwwwwwwwww...",
  "..wwwwwwwwwwwwwwwwwwwwwww...",
  "..www..www..www..www..www...",
  ".......ttt.......ttt........",
  ".......t.t.......t.t........",
];

/** Second float frame: the hem ripples one pixel over and the feet sway with it. */
export const VOYAGER_B = patch(VOYAGER_A, {
  28: "...www..www..www..www..ww...",
  29: "........ttt.......ttt.......",
  30: "........t.t.......t.t.......",
});

/** The horn rises from the middle of the cap; its base sits on this row of the voyager grid. */
export const HORN_BASE_ROW = 1;
/** Left column of the 5-wide horn grid, so it centres on the cap. */
export const HORN_COLUMN = 11;
export const HORN_STAGES = [2, 3, 4, 5, 6];

/**
 * A spiral unicorn horn `height` pixels tall and 5 wide at the base, gold-edged. It tapers
 * in thirds (3 → 2 → 1 pixels inside the edge) and leans toward the facing side; the pink
 * groove steps one pixel per row, which reads as a twist.
 */
export function hornGrid(height: number): string[] {
  const rows = ["...q."];
  for (let i = 1; i < height; i++) {
    const fromBase = height - 1 - i;
    let row: string;
    if (fromBase < Math.ceil(height / 3)) row = "q" + ["Uuu", "uUu", "uuU", "uuu"][fromBase % 4] + "q";
    else if (fromBase < Math.ceil((2 * height) / 3)) row = ".q" + ["Uu", "uU", "uu"][fromBase % 3] + "q";
    else row = "..q" + (fromBase % 2 ? "U" : "u") + "q";
    rows.push(row.padEnd(5, "."));
  }
  return rows;
}

// Little signs that pop above a head: a 航星者 visiting 藍咩, 藍咩 waking with a start, a nap.
export const HEART: readonly string[] = [
  ".r.r.",
  "rurrr",
  ".rrr.",
  "..r..",
];
export const EXCLAIM: readonly string[] = ["t", "t", "t", ".", "t"];
export const ZZZ: readonly string[] = [
  "uuuu",
  "..u.",
  ".u..",
  "uuuu",
];

/** All they ever say: 藍咩 bleats, 航星者 honk. */
export const LINES = { blueme: ["咩!"], voyager: ["嘎!", "嘎嘎~"] };

/** The letters those lines use, 12 pixels tall: 口 on the left of each, the rest pared down to fit. */
export const GLYPHS: Record<string, readonly string[]> = {
  咩: [
    "......e...e.",
    ".......e.e..",
    ".....eeeeeee",
    "eeee....e...",
    "e..e..eeeee.",
    "e..e....e...",
    "e..e....e...",
    "e..e.eeeeeee",
    "eeee....e...",
    "........e...",
    "........e...",
    "........e...",
  ],
  嘎: [
    ".....eeeeeee",
    ".......e....",
    "......eeeee.",
    "eeee..e...e.",
    "e..e..eeeee.",
    "e..e..e...e.",
    "e..e..eeeee.",
    "e..e......e.",
    "eeee.eeeeeee",
    "........e.e.",
    ".........e..",
    "........e.ee",
  ],
  "~": [".......", ".......", ".......", ".......", ".......", ".ee....", "e..e..e", "....ee.", ".......", ".......", ".......", "......."],
  "!": ["..", "ee", "ee", "ee", "ee", "ee", "ee", "ee", "..", "..", "ee", "ee"],
};

/** A bubble's tail opens this many pixels in from its end; the tip sits 3 pixels further out. */
const TAIL_AT = 4;
export const TAIL_TIP = TAIL_AT - 3;

/**
 * `text` in a speech bubble: a 2-pixel margin inside an outline with the corners knocked off, and
 * a 3-row tail under one end whose tip leans outward, toward the speaker. The tip is the bottom
 * row's leftmost pixel (rightmost for a tail on the right), `TAIL_TIP` in from that end.
 */
export function speechBubble(text: string, tail: "left" | "right"): string[] {
  const glyphs = [...text].map((ch) => GLYPHS[ch]);
  const letters = glyphs[0].map((_, y) => glyphs.map((g) => g[y]).join("."));
  const inner = letters[0].length + 4;
  const w = inner + 2;
  const blank = "k" + "b".repeat(inner) + "k";
  const pad = (row: string, from: number) => (".".repeat(from) + row).padEnd(w, ".");
  const rows = [
    "." + "k".repeat(inner) + ".",
    blank,
    blank,
    ...letters.map((row) => "kbb" + row.replace(/\./g, "b") + "bbk"),
    blank,
    blank,
    // The bottom edge, open where the tail hangs from it.
    "." + "k".repeat(TAIL_AT - 1) + "bbb" + "k".repeat(inner - TAIL_AT - 2) + ".",
    pad("kbbk", TAIL_AT - 1),
    pad("kbkk", TAIL_AT - 2),
    pad("kkk", TAIL_AT - 3),
  ];
  if (tail === "left") return rows;
  // Flip only the bottom edge and the tail; the letters still read left to right.
  return rows.map((row, i) => (i < rows.length - 4 ? row : [...row].reverse().join("")));
}

/** Draws a grid at 1 pixel per letter into its own canvas, to be scaled up with smoothing off. */
export function buildSprite(rows: readonly string[]): HTMLCanvasElement {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const color = PALETTE[rows[y][x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}
