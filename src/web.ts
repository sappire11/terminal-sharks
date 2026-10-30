/**
 * Window build, run in a browser (`npm run dev`) or inside the Tauri screensaver shell.
 *
 * Mode comes from the Tauri shell (`window.__SHARKS_MODE__`), or `?mode=` in a browser:
 *   interactive  default; in the shark ocean the mouse lures fish and a click splashes
 *   saver        cursor hidden; any key, click or real mouse move quits
 *   config       the screensaver "Settings" dialog: pick the scene
 *   sprites      every space sprite enlarged on one page, for checking the pixel art
 *
 * Scene: `?scene=sharks|space`, else the one saved from the settings dialog, else sharks.
 * Shark ocean: `?sharks=tiger,mako` picks species. Space: `?count=5` sets the number of
 * 航星者, `?mutate=fast` grows horns within seconds, `?events=fast` brings on visits, convoys
 * and naps every few seconds instead of every 15–30, comets and asteroids far more often, and
 * lets them talk again after a few seconds.
 */
import { buildSpecs } from "./lineup";
import { AsciiRenderer } from "./renderer";
import { SpaceScene } from "./space/scene";
import * as sprites from "./space/sprites";
import { World } from "./world";

type Mode = "interactive" | "saver" | "config" | "sprites";
type SceneName = "sharks" | "space";

declare global {
  interface Window {
    __SHARKS_MODE__?: Mode;
    __TAURI_INTERNALS__?: unknown;
  }
}

interface Scene {
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
  step(dt: number): void;
  render(dt: number): void;
}

const STEP = 1 / 60;
/** Pixels the mouse may drift before the screensaver counts it as the user coming back. */
const WAKE_DISTANCE = 10;
const SCENE_KEY = "terminal-sharks.scene";
const SCENES: Record<SceneName, string> = { sharks: "鯊魚海洋", space: "宇宙：藍咩與航星者" };

const params = new URLSearchParams(location.search);
const mode: Mode = window.__SHARKS_MODE__ ?? (params.get("mode") as Mode | null) ?? "interactive";

function isScene(name: string | null): name is SceneName {
  return name === "sharks" || name === "space";
}

function savedScene(): SceneName | null {
  try {
    const name = localStorage.getItem(SCENE_KEY);
    return isScene(name) ? name : null;
  } catch {
    return null;
  }
}

function saveScene(name: SceneName) {
  try {
    localStorage.setItem(SCENE_KEY, name);
    return true;
  } catch {
    return false;
  }
}

async function quit() {
  if (window.__TAURI_INTERNALS__) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("quit");
  } else {
    window.close();
  }
}

function showConfig() {
  const current = savedScene() ?? "sharks";
  const options = (Object.keys(SCENES) as SceneName[])
    .map(
      (name) => `
      <label><input type="radio" name="scene" value="${name}" ${name === current ? "checked" : ""}> ${SCENES[name]}</label>`,
    )
    .join("");
  document.body.innerHTML = `
    <form class="config">
      <p>螢幕保護程式要顯示的場景：</p>
      ${options}
      <p class="status" aria-live="polite"></p>
      <p class="hint">想立刻看：對 <code>terminal-sharks.scr</code> 按右鍵選「測試」。</p>
    </form>`;
  const status = document.querySelector<HTMLElement>(".status")!;
  document.querySelector("form")!.addEventListener("change", (e) => {
    const name = (e.target as HTMLInputElement).value;
    if (!isScene(name)) return;
    status.textContent = saveScene(name) ? `已儲存：${SCENES[name]}` : "無法儲存設定";
  });
}

/** Every space sprite at 8×, labelled, for comparing against the original drawings. */
function showSprites() {
  const frames: [string, readonly string[]][] = [
    ["藍咩 睜眼", sprites.BLUEME_OPEN],
    ["藍咩 閉眼", sprites.BLUEME_CLOSED],
    ["藍咩 拉長", sprites.BLUEME_TALL],
    ["藍咩 壓扁", sprites.BLUEME_SHORT],
    ["航星者 A", sprites.VOYAGER_A],
    ["航星者 B", sprites.VOYAGER_B],
    ...sprites.HORN_STAGES.map((h): [string, string[]] => [`角 ${h} 格`, sprites.hornGrid(h)]),
    ["愛心", sprites.HEART],
    ["驚嘆號", sprites.EXCLAIM],
    ["瞌睡 z", sprites.ZZZ],
    ...Object.entries(sprites.GLYPHS).map(([ch, grid]): [string, readonly string[]] => [`字 ${ch}`, grid]),
    ...[...sprites.LINES.blueme, ...sprites.LINES.voyager].flatMap((line): [string, string[]][] => [
      [`${line} 左尾`, sprites.speechBubble(line, "left")],
      [`${line} 右尾`, sprites.speechBubble(line, "right")],
    ]),
  ];
  const sheet = document.createElement("div");
  sheet.className = "sprites";
  for (const [label, grid] of frames) {
    const src = sprites.buildSprite(grid);
    const big = document.createElement("canvas");
    big.width = src.width * 8;
    big.height = src.height * 8;
    const ctx = big.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, big.width, big.height);
    const figure = document.createElement("figure");
    const caption = document.createElement("figcaption");
    caption.textContent = label;
    figure.append(big, caption);
    sheet.append(figure);
  }
  document.body.classList.add("sheet");
  document.body.append(sheet);
}

function createSharks(canvas: HTMLCanvasElement): Scene {
  const renderer = new AsciiRenderer(canvas);
  renderer.setFontFamily('Consolas, "Cascadia Mono", ui-monospace, monospace');
  const world = new World(buildSpecs(params.get("sharks")?.split(",").filter(Boolean)));
  // Same as the terminal: let the sharks grow with the screen instead of the web hero's cap.
  world.maxSharkLength = Infinity;

  if (mode === "interactive") {
    window.addEventListener("pointermove", (e) => {
      world.pointer.x = e.clientX;
      world.pointer.y = e.clientY;
      world.pointer.active = true;
    });
    window.addEventListener("pointerleave", () => (world.pointer.active = false));
    window.addEventListener("pointerdown", (e) => world.splash(e.clientX, e.clientY));
  }

  return {
    resize(w, h, dpr) {
      renderer.resize(w, h, dpr);
      world.resize(w, h, renderer.cellWidth, renderer.cellHeight);
    },
    step(dt) {
      // Equal substeps no longer than STEP, as in term.ts.
      const steps = Math.max(1, Math.ceil(dt / STEP - 0.01));
      for (let k = 0; k < steps; k++) world.step(dt / steps);
    },
    render(dt) {
      renderer.render(world, dt);
    },
  };
}

function createSpace(canvas: HTMLCanvasElement): Scene {
  const count = Number(params.get("count"));
  const scene = new SpaceScene(canvas, {
    voyagers: count > 0 ? Math.floor(count) : undefined,
    fastMutation: params.get("mutate") === "fast",
    fastEvents: params.get("events") === "fast",
  });
  return {
    resize: (w, h, dpr) => scene.resize(w, h, dpr),
    step: (dt) => scene.step(dt),
    render: () => scene.render(),
  };
}

function run() {
  if (mode === "saver") document.body.classList.add("saver");
  const canvas = document.createElement("canvas");
  document.body.append(canvas);

  const query = params.get("scene");
  const name = isScene(query) ? query : (savedScene() ?? "sharks");
  const scene = name === "space" ? createSpace(canvas) : createSharks(canvas);

  function resize() {
    scene.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
  }
  window.addEventListener("resize", resize);
  resize();

  if (mode === "saver") {
    let origin: { x: number; y: number } | null = null;
    window.addEventListener("mousemove", (e) => {
      // Windows sends a mousemove when the window appears; only real movement wakes.
      if (!origin) return void (origin = { x: e.clientX, y: e.clientY });
      if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > WAKE_DISTANCE) quit();
    });
    for (const type of ["keydown", "mousedown", "wheel", "touchstart"]) window.addEventListener(type, quit);
  }

  let last = performance.now();
  function frame(now: number) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    scene.step(dt);
    scene.render(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (mode === "config") showConfig();
else if (mode === "sprites") showSprites();
else run();
