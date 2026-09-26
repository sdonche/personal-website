/* plant.js — Heuvelland plant HMI entry (ES modules). */
import "./plant/constants.js?v=3343b23463";
import "./plant/util.js?v=7bf6777936";
import "./plant/state.js?v=61c1329a4f";
import "./plant/sim.js?v=a0bf6d8b76";
import "./plant/tree.js?v=39ebd03c55";
import "./plant/pid.js?v=7cbe53c3f2";
import "./plant/faceplate.js?v=7601dbd7d9";
import "./plant/alarms.js?v=d9e1130e85";
import "./plant/routing.js?v=cd4b65525c";
import "./plant/actions.js?v=af02f478b9";
import "./plant/ui.js?v=8bcc3b24fe";
import { boot } from "./plant/main.js?v=738586cbe6";

boot();
