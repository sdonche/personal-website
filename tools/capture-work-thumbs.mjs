#!/usr/bin/env node
/*
 * Re-capture the homepage "Selected work" thumbnails from the live pages.
 *
 *   make thumbs          (or: node tools/capture-work-thumbs.mjs)
 *
 * Serves the repo on a throwaway local port, opens each page in headless
 * Chromium, crops the panel we want and writes a 960×540 WebP + JPEG pair
 * to assets/img/work/. Commit the images afterwards.
 *
 * Needs Node 18+ and Playwright:
 *   npm install --no-save playwright && npx playwright install chromium
 * (node_modules/ is gitignored). Set CHROMIUM_PATH to use an existing
 * Chromium binary instead of Playwright's download.
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets/img/work");
const SIZE = { width: 960, height: 540 };

// One entry per thumbnail. `crop` gets the page and returns a clip rect.
const SHOTS = [
  {
    name: "plant-hmi",
    path: "plant/",
    viewport: { width: 1280, height: 960 },
    settleMs: 3500, // let the sim tick so values and batch position look live
    // The Packaging Line 3 P&ID at 16:9, centred on the drawing
    crop: async (page) => {
      const c = await page.locator(".plant-mimic__canvas").boundingBox();
      if (!c) throw new Error("plant: .plant-mimic__canvas not found — did the HMI layout change?");
      const height = (c.width * 9) / 16;
      return { x: c.x, y: c.y + (c.height - height) / 2, width: c.width, height };
    },
  },
];

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright is not installed. Run:\n  npm install --no-save playwright && npx playwright install chromium");
  process.exit(1);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`local server did not start at ${url}`);
}

const port = await freePort();
const base = `http://127.0.0.1:${port}/`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
  cwd: ROOT,
  stdio: "ignore",
});

let browser;
try {
  await waitForServer(base);
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

  for (const shot of SHOTS) {
    const page = await browser.newPage({ viewport: shot.viewport, deviceScaleFactor: 2, colorScheme: "dark" });
    await page.goto(base + shot.path, { waitUntil: "load" });
    await page.waitForTimeout(shot.settleMs);
    const png = await page.screenshot({ clip: await shot.crop(page) });

    // Resize + encode in the browser (canvas) so there is no image-library dependency
    const enc = await browser.newPage();
    await enc.setContent(`<canvas id="c" width="${SIZE.width}" height="${SIZE.height}"></canvas>`);
    const out = await enc.evaluate(async (b64) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const c = document.getElementById("c");
      const ctx = c.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return { webp: c.toDataURL("image/webp", 0.8), jpg: c.toDataURL("image/jpeg", 0.78) };
    }, png.toString("base64"));

    for (const [ext, url] of Object.entries(out)) {
      const file = join(OUT, `${shot.name}.${ext}`);
      writeFileSync(file, Buffer.from(url.split(",")[1], "base64"));
      console.log("wrote", file.replace(ROOT + "/", ""));
    }
    await page.close();
    await enc.close();
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}
