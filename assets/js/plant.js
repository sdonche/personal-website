/* plant.js — Heuvelland plant HMI entry (ES modules). */
import "./plant/constants.js?v=0d79ee5fba";
import "./plant/util.js?v=bf11540763";
import "./plant/state.js?v=a9d2ba2813";
import "./plant/sim.js?v=02a2f17dd0";
import "./plant/tree.js?v=804f65d15f";
import "./plant/pid.js?v=3ac9d56d41";
import "./plant/faceplate.js?v=1560e4dcde";
import "./plant/alarms.js?v=e0091dd5f6";
import "./plant/routing.js?v=15f4a83d4f";
import "./plant/actions.js?v=74dc10ebf2";
import "./plant/ui.js?v=d6c61c8e0a";
import { boot } from "./plant/main.js?v=2e27b8af88";

boot();
