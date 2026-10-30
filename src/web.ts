/**
 * Window build: the same World + AsciiRenderer as the terminal port, drawn on a real canvas.
 * Runs in a browser (`npm run dev`) or inside the Tauri screensaver shell.
 *
 * Mode comes from the Tauri shell (`window.__SHARKS_MODE__`), or `?mode=` in a browser:
 *   interactive  default; the mouse lures fish, a click splashes
 *   saver        cursor hidden; any key, click or real mouse move quits
 *   config       the screensaver "Settings" dialog
 */
import { buildSpecs } from "./lineup";
import { AsciiRenderer } from "./renderer";
import { World } from "./world";

type Mode = "interactive" | "saver" | "config";

declare global {
  interface Window {
    __SHARKS_MODE__?: Mode;
    __TAURI_INTERNALS__?: unknown;
  }
}

const STEP = 1 / 60;
/** Pixels the mouse may drift before the screensaver counts it as the user coming back. */
const WAKE_DISTANCE = 10;

const mode: Mode = window.__SHARKS_MODE__ ?? (new URLSearchParams(location.search).get("mode") as Mode | null) ?? "interactive";

async function quit() {
  if (window.__TAURI_INTERNALS__) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("quit");
  } else {
    window.close();
  }
}

function showConfig() {
  document.body.innerHTML = `
    <div class="config">
      <p>terminal-sharks 螢幕保護程式目前沒有設定項目。</p>
      <p>想立刻看鯊魚：對 <code>terminal-sharks.scr</code> 按右鍵選「測試」，
      或建一個指向 <code>terminal-sharks.scr /s</code> 的捷徑並設定快速鍵。</p>
    </div>`;
}

function run() {
  if (mode === "saver") document.body.classList.add("saver");
  const canvas = document.createElement("canvas");
  document.body.append(canvas);

  const renderer = new AsciiRenderer(canvas);
  renderer.setFontFamily('Consolas, "Cascadia Mono", ui-monospace, monospace');
  const query = new URLSearchParams(location.search).get("sharks");
  const world = new World(buildSpecs(query?.split(",").filter(Boolean)));
  // Same as the terminal: let the sharks grow with the screen instead of the web hero's cap.
  world.maxSharkLength = Infinity;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.resize(w, h, window.devicePixelRatio || 1);
    world.resize(w, h, renderer.cellWidth, renderer.cellHeight);
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
  } else {
    window.addEventListener("pointermove", (e) => {
      world.pointer.x = e.clientX;
      world.pointer.y = e.clientY;
      world.pointer.active = true;
    });
    window.addEventListener("pointerleave", () => (world.pointer.active = false));
    window.addEventListener("pointerdown", (e) => world.splash(e.clientX, e.clientY));
  }

  let last = performance.now();
  function frame(now: number) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    // Advance by the real elapsed time in equal substeps no longer than STEP, as in term.ts.
    const steps = Math.max(1, Math.ceil(dt / STEP - 0.01));
    for (let k = 0; k < steps; k++) world.step(dt / steps);
    renderer.render(world, dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (mode === "config") showConfig();
else run();
