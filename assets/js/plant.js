/* plant.js — Heuvelland plant HMI entry (ES modules). */
import "./plant/constants.js?v=54ad5f772f";
import "./plant/util.js?v=f70fb8ddd5";
import "./plant/state.js?v=5df036f1a2";
import "./plant/sim.js?v=be810314fc";
import "./plant/tree.js?v=39ebd03c55";
import "./plant/pid.js?v=c091a10728";
import "./plant/faceplate.js?v=1560e4dcde";
import "./plant/alarms.js?v=e0091dd5f6";
import "./plant/routing.js?v=cd4b65525c";
import "./plant/actions.js?v=8580192a04";
import "./plant/ui.js?v=6995c4c3ed";
import { boot } from "./plant/main.js?v=2e27b8af88";

boot();
