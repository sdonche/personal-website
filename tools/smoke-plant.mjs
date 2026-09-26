#!/usr/bin/env node
/*
 * Smoke test for the plant HMI (/plant/) — run in CI and locally:
 *
 *   make smoke          (or: node tools/smoke-plant.mjs)
 *
 * Serves the repo on a throwaway port, opens the HMI in headless Chromium with
 * a fake clock (so plant hours pass in milliseconds) and checks that:
 *   · every drawing renders its P&ID and unit controls, without console errors
 *   · a fault latches its unit, and Clear → Reset → Start brings it back
 *   · alarms raise, and the events journal records operator actions
 *   · a setpoint write goes through its two-step confirm
 *   · the guided tour runs end to end and leaves the visitor's plant alone
 *   · the deep links used by the notes and the case study open what they promise
 *
 * Needs Node 18+ and Playwright:
 *   npm install --no-save playwright && npx playwright install chromium
 * Set CHROMIUM_PATH to use an existing Chromium binary instead.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`local server did not start at ${url}`);
}

const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${what}`);
  if (!ok) failures.push(what);
};

const port = await freePort();
const base = `http://127.0.0.1:${port}/`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });

let browser;
try {
  await waitForServer(base);
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

  // A fresh page per scenario: clean localStorage, fake clock, errors collected
  const open = async (hash, viewport = { width: 1440, height: 900 }) => {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    page.setDefaultTimeout(5000); // a broken control should fail fast, not hang
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.clock.install();
    await page.goto(`${base}plant/${hash}`);
    await page.clock.runFor(3000);
    return { page, errors, close: () => ctx.close() };
  };
  const text = (page, sel) => page.locator(sel).first().textContent();
  const unitState = (page) => text(page, ".plant-unit-state");
  // Run one scenario; an exception (e.g. a control that never enables) is a failed check
  const scenario = async (name, fn) => {
    console.log(name);
    try {
      await fn();
    } catch (e) {
      check(false, `${name}: ${String(e.message || e).split("\n")[0]}`);
    }
  };

  await scenario("Drawings", async () => {
    const { page, errors, close } = await open("#overview");
    for (const d of ["overview", "mixing", "refining", "conching", "tempering", "moulding", "packaging"]) {
      await page.locator(`.plant-area-nav__btn[data-drawing="${d}"]`).click();
      await page.clock.runFor(5000);
      const svg = await page.locator("#plant-pid svg").count();
      const state = d === "overview" ? "n/a" : await unitState(page);
      check(svg > 0 && (d === "overview" || /RUNNING|EXECUTE/.test(state)), `${d}: P&ID drawn, unit ${state}`);
    }
    // Long run: a full plant shift and the change to the next one
    await page.clock.runFor(500_000);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("samdonche.plant.v15")));
    check(saved.oee.shift === 1, `soak: ${saved.tick} plant minutes, shift change booked`);
    check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
    await close();
  });

  await scenario("Fault → recovery (ISA-88)", async () => {
    const { page, errors, close } = await open("#conching?fault=overtemp");
    await page.clock.runFor(30_000);
    check((await unitState(page)) === "ABORTED", "overtemp latches CN-300 in ABORTED");
    check(await page.locator(".plant-alarm").count() > 0, "an alarm is raised");
    check(await page.locator('[data-unit-cmd="reset"]').isDisabled(), "Reset is interlocked while the fault is active");
    await page.locator('[data-conche-scenario="recover"]').click();
    check((await unitState(page)) === "ABORTED", "clearing the fault leaves the unit latched");
    await page.locator('[data-unit-cmd="reset"]').click();
    check((await unitState(page)) === "IDLE", "Reset → IDLE");
    await page.locator('[data-unit-cmd="start"]').click();
    check((await unitState(page)) === "RUNNING", "Start → RUNNING");
    await page.locator('[data-alarm-pane="events"]').click();
    const journal = await page.locator(".plant-event").allTextContents();
    check(journal.some((t) => /RESET/.test(t)) && journal.some((t) => /START/.test(t)), "events journal records the commands");
    check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
    await close();
  });

  await scenario("Hold → unhold (PackML) and setpoint write", async () => {
    const { page, errors, close } = await open("#packaging?fault=jam");
    await page.clock.runFor(5000);
    check((await unitState(page)) === "HELD", "cartoner jam holds Line 3");
    await page.locator('[data-pack-scenario="recover"]').click();
    await page.locator('[data-unit-cmd="unhold"]').click();
    await page.clock.runFor(5000);
    check((await unitState(page)) === "EXECUTE", "Unhold → UNHOLDING → EXECUTE");

    await page.goto(`${base}plant/#tempering?tag=Tempering/Temper1/Zone2TempC`);
    await page.clock.runFor(3000);
    const input = page.locator('#plant-detail input[name="sp"]');
    await input.fill("99");
    await page.locator('[data-fp-step="stage"]').click();
    check(/Out of range/.test(await text(page, "[data-fp-msg]")), "an out-of-range setpoint is refused");
    await input.fill("29");
    await page.locator('[data-fp-step="stage"]').click();
    check(/28\.0 °C → 29\.0 °C/.test(await text(page, "[data-fp-confirm-text]")), "Write… asks to confirm old → new");
    await page.locator('[data-fp-step="confirm"]').click();
    await page.clock.runFor(2000);
    check(/29\.0 °C/.test(await text(page, "[data-fp-sp]")), "the setpoint in force is the written one");
    check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
    await close();
  });

  await scenario("Guided tour", async () => {
    const { page, errors, close } = await open("#mixing");
    check(await page.locator("#plant-tour-hint").isVisible(), "first visit shows the tour hint");
    const mine = await page.evaluate(() => localStorage.getItem("samdonche.plant.v15"));
    await page.locator("#plant-tour-btn").click();
    const seen = [];
    for (let i = 0; i < 20; i++) {
      await page.clock.runFor(1500);
      seen.push(await text(page, "[data-tour-count]"));
      if (await page.locator('[data-tour="keep"]').count()) break;
      if (await page.locator('[data-tour="auto"]').count()) await page.locator('[data-tour="auto"]').click();
      else if (await page.locator('[data-tour="next"]:not([disabled])').count()) await page.locator('[data-tour="next"]').click();
    }
    check(new Set(seen).size === 7 && seen.at(-1) === "7 / 7", `walks all seven steps (${[...new Set(seen)].join(", ")})`);
    const trail = await page.locator(".plant-event").allTextContents();
    check(["SIM", "ACK", "RESET", "START"].every((k) => trail.some((t) => t.includes(k))), "the journal holds the incident");
    check((await page.evaluate(() => localStorage.getItem("samdonche.plant.v15"))) === mine, "the tour never saves over the visitor's plant");
    await page.locator('[data-tour="skip"]').click();
    const back = await page.evaluate(() => ({ tour: !!document.querySelector("#plant-tour"), hash: location.hash }));
    check(!back.tour && back.hash === "#mixing", "Back to my shift restores the visitor's plant");
    await close();

    const deep = await open("#tour");
    check(await deep.page.locator("#plant-tour").isVisible(), "#tour opens the tour");
    await deep.page.keyboard.press("Escape");
    check(!(await deep.page.locator("#plant-tour").count()), "Esc closes it");
    check(errors.length === 0 && deep.errors.length === 0, `no console errors${[...errors, ...deep.errors].length ? `: ${[...errors, ...deep.errors][0]}` : ""}`);
    await deep.close();
  });

  await scenario("Deep links from the notes and case study", async () => {
    // Every plant link in the writing must open a drawing, tag or view that exists
    const pages = ["case-studies/plant-hmi/index.html", "notes/mes-scada-vs-historian/index.html", "notes/mqtt-sparkplug-b/index.html"];
    const links = new Set();
    for (const p of pages) {
      for (const m of readFileSync(join(ROOT, p), "utf8").matchAll(/href="(?:\.\.\/)+plant\/(#[^"]+)"/g)) links.add(m[1]);
    }
    check(links.size >= 5, `${links.size} plant deep links found`);
    links.delete("#tour"); // the tour has its own scenario above
    for (const hash of links) {
      const { page, errors, close } = await open(hash);
      const q = new URLSearchParams(hash.split("?")[1] || "");
      const drawing = hash.slice(1).split("?")[0];
      const active = await page.locator(`.plant-area-nav__btn[data-drawing="${drawing}"]`).getAttribute("aria-selected");
      let ok = active === "true";
      if (q.get("tag")) ok = ok && (await page.locator("#plant-detail").getAttribute("data-fp-tag")) === q.get("tag");
      if (q.get("fault")) ok = ok && !/RUNNING|EXECUTE/.test(await unitState(page));
      check(ok && errors.length === 0, `${hash}${errors.length ? ` (${errors[0]})` : ""}`);
      await close();
    }
  });
} finally {
  if (browser) await browser.close();
  server.kill();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nPlant smoke test passed");
