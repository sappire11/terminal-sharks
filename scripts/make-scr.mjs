// Builds the Tauri shell and copies it out as a screensaver: release/terminal-sharks.scr
// Then packs a copy with the install guide into release/terminal-sharks.zip for sharing.
//   node scripts/make-scr.mjs             build + pack
//   node scripts/make-scr.mjs --pack-only pack the existing release/terminal-sharks.scr
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";

const scr = "release/terminal-sharks.scr";

if (!process.argv.includes("--pack-only")) {
  // Call the local CLI directly: `npx` can stall waiting on an install prompt.
  execSync("node node_modules/@tauri-apps/cli/tauri.js build --no-bundle", { stdio: "inherit" });

  const exe = "src-tauri/target/release/terminal-sharks.exe";
  if (!existsSync(exe)) {
    console.error(`Build finished but ${exe} is missing.`);
    process.exit(1);
  }
  mkdirSync("release", { recursive: true });
  // Keep this path stable: an installed screensaver points at it.
  copyFileSync(exe, scr);
}

if (!existsSync(scr)) {
  console.error(`${scr} is missing; run without --pack-only first.`);
  process.exit(1);
}
rmSync("release/share", { recursive: true, force: true });
mkdirSync("release/share");
copyFileSync(scr, "release/share/terminal-sharks.scr");
copyFileSync("docs/安裝說明.txt", "release/share/安裝說明.txt");
execSync(
  "powershell -NoProfile -Command Compress-Archive -Path release/share/* -DestinationPath release/terminal-sharks.zip -Force",
  { stdio: "inherit" },
);
console.log(`\nDone: ${scr} (right-click it → Install / Test)`);
console.log("Share: release/terminal-sharks.zip (screensaver + 安裝說明.txt)");
