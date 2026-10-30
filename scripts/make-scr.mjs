// Builds the Tauri shell and copies it out as a screensaver: release/terminal-sharks.scr
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";

// Call the local CLI directly: `npx` can stall waiting on an install prompt.
execSync("node node_modules/@tauri-apps/cli/tauri.js build --no-bundle", { stdio: "inherit" });

const exe = "src-tauri/target/release/terminal-sharks.exe";
if (!existsSync(exe)) {
  console.error(`Build finished but ${exe} is missing.`);
  process.exit(1);
}
mkdirSync("release", { recursive: true });
copyFileSync(exe, "release/terminal-sharks.scr");
console.log("\nDone: release/terminal-sharks.scr (right-click it → Install / Test)");
