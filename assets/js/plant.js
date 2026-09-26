/* plant.js — Heuvelland plant HMI entry (ES modules). */
import "./plant/constants.js?v=b2b6ec2b96";
import "./plant/util.js?v=e2ef67dac1";
import "./plant/state.js?v=4ec90e6ad5";
import "./plant/sim.js?v=a3d0233bd3";
import "./plant/tree.js?v=39ebd03c55";
import "./plant/pid.js?v=8bc592ad2b";
import "./plant/faceplate.js?v=7601dbd7d9";
import "./plant/alarms.js?v=e0091dd5f6";
import "./plant/routing.js?v=cd4b65525c";
import "./plant/actions.js?v=98ca241ef6";
import "./plant/ui.js?v=b34377c88c";
import { boot } from "./plant/main.js?v=2e27b8af88";

boot();
