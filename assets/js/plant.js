/* plant.js — Heuvelland plant HMI entry (ES modules). */
import "./plant/constants.js?v=ad956b5a10";
import "./plant/util.js?v=056e4f2a43";
import "./plant/state.js?v=04214647a0";
import "./plant/sim.js?v=b3646e317b";
import "./plant/tree.js?v=22f30d4c87";
import "./plant/pid.js?v=971e47a321";
import "./plant/faceplate.js?v=a495f9bba3";
import "./plant/alarms.js?v=fdcb52d244";
import "./plant/routing.js?v=18688c3399";
import "./plant/actions.js?v=f532b90cda";
import "./plant/ui.js?v=308e67f97f";
import { boot } from "./plant/main.js?v=2e27b8af88";

boot();
