/* plant.js — Heuvelland plant HMI entry (ES modules). */
import "./plant/constants.js?v=e089c6fdcf";
import "./plant/util.js?v=bf11540763";
import "./plant/state.js?v=a9d2ba2813";
import "./plant/sim.js?v=71ca17da8c";
import "./plant/tree.js?v=804f65d15f";
import "./plant/pid.js?v=c1e1f6c3c6";
import "./plant/faceplate.js?v=1560e4dcde";
import "./plant/alarms.js?v=e0091dd5f6";
import "./plant/routing.js?v=15f4a83d4f";
import "./plant/actions.js?v=74dc10ebf2";
import "./plant/ui.js?v=4f6f10e5b7";
import { boot } from "./plant/main.js?v=2e27b8af88";

boot();
