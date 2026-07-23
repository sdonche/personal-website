/* =============================================================
   eggs.js — shared easter-egg registry + discovery tracking.
   Loaded by both the main page (script.js records unlocks) and the
   hidden Operator Log at /log/ (renders progress). Persists to
   localStorage so discoveries survive across visits. No dependencies.
   ============================================================= */
window.EGGS = (function () {
  "use strict";

  const KEY = "samdonche.eggs.v1";

  /* One entry per egg. `how` is shown once discovered; `hint` is the
     redacted teaser shown while it's still locked. */
  const REGISTRY = [
    { id: "console",   name: "Console operator", how: "Open DevTools — the console greets you, then try samdonche.help().", hint: "the tools of the trade greet those who open them" },
    { id: "commands",  name: "Command line",     how: "⌘K / Ctrl+K, then type a verb: sudo, whoami, 42, coffee, uptime…",  hint: "the palette answers to more than tags" },
    { id: "konami",    name: "Night shift",      how: "↑ ↑ ↓ ↓ ← → ← → B A — flips the plant to amber HMI mode.",           hint: "an old code from an older console" },
    { id: "boot",      name: "Cold start",       how: "Visit ?boot, run samdonche.boot(), or ⌘K → boot.",                   hint: "every gateway begins somewhere" },
    { id: "estop",     name: "Emergency stop",   how: "Find and press the big red button (bottom-left corner).",            hint: "when in doubt, hit the big red one" },
    { id: "mqtt",      name: "Publisher",        how: "Click the MQTT broker at the heart of the architecture diagram.",    hint: "the broker is listening — give it a nudge" },
    { id: "telemetry", name: "Telemetry",        how: "Click 'SYSTEM: ONLINE' in the top bar for a live readout.",          hint: "the status line has more to say" },
    { id: "tour",      name: "Full plant tour",  how: "Visit every tag in the browser (top-level sections + each role).",   hint: "leave no tag unseen" },
    { id: "log",       name: "Operator log",     how: "You're reading it — /log/, samdonche.secrets(), or ⌘K → log.",       hint: "somewhere, the operator keeps a log" },
  ];

  function discovered() {
    try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); }
    catch (e) { return new Set(); }
  }

  /* Returns true only the FIRST time an id is unlocked. */
  function unlock(id) {
    const s = discovered();
    if (s.has(id)) return false;
    s.add(id);
    try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch (e) {}
    return true;
  }

  function rankFor(n) {
    const total = REGISTRY.length;
    if (n >= total) return "Plant Architect";
    if (n >= 6)     return "Architect";
    if (n >= 3)     return "Engineer";
    if (n >= 1)     return "Operator";
    return "Visitor";
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  return { REGISTRY, discovered, unlock, rankFor, reset, KEY };
})();
