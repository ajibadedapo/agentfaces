import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = process.argv[2] ?? join(root, "assets", "demo.gif");
const pagePath = process.argv[3] ?? "demo.html";
const stillsAt = (process.env.STILLS_AT ?? "").split(",").filter(Boolean).map(Number);
const REEL_MS = 12000;
const FPS = 20;
const WIDTH = 640;

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("This script needs Playwright. Run: npm install --no-save playwright && npx playwright install chromium");
  process.exit(1);
}

const server = await createServer({ configFile: join(root, "docs", "vite.config.ts"), server: { port: 5199, strictPort: true }, logLevel: "error" });
await server.listen();
const frames = mkdtempSync(join(tmpdir(), "agentfaces-reel-"));

try {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 760, height: 320 }, deviceScaleFactor: 2, reducedMotion: "no-preference" });
  await page.clock.install({ time: 0 });
  await page.goto(`http://localhost:5199/agentfaces/${pagePath}`);
  await page.waitForSelector("#reel svg");
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 50);
  await page.evaluate(() => {
    window.__reelBirth = new WeakMap();
  });
  const reel = page.locator("#reel");
  const step = 1000 / FPS;
  const total = Math.round((REEL_MS / 1000) * FPS);
  for (let i = 0; i < total; i++) {
    await page.clock.runFor(step);
    await page.evaluate((now) => {
      for (const animation of document.getAnimations()) {
        if (!window.__reelBirth.has(animation)) window.__reelBirth.set(animation, now);
        animation.pause();
        animation.currentTime = now - window.__reelBirth.get(animation);
      }
    }, (i + 1) * step);
    const frame = join(frames, `${String(i).padStart(4, "0")}.png`);
    await reel.screenshot({ path: frame });
    const at = Math.round((i + 1) * step);
    if (stillsAt.some((ms) => Math.abs(ms - at) < step / 2)) copyFileSync(frame, output.replace(/\.gif$/, `-${at}ms.png`));
  }
  await browser.close();
  const palette = join(frames, "palette.png");
  const scale = `fps=${FPS},scale=${WIDTH}:-1:flags=lanczos`;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(frames, "%04d.png"), "-vf", `${scale},palettegen=max_colors=96:stats_mode=diff`, palette]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(frames, "%04d.png"), "-i", palette, "-lavfi", `${scale}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, "-loop", "0", output]);
  console.log(`wrote ${output} (${(statSync(output).size / 1024).toFixed(0)} KB, ${total} frames)`);
} finally {
  await server.close();
  rmSync(frames, { recursive: true, force: true });
}
