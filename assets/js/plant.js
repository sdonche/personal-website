/* plant.js — Heuvelland plant HMI entry (ES modules). */
import "./plant/constants.js?v=29a49f6385";
import "./plant/util.js?v=2f8450b5f9";
import "./plant/state.js?v=a9d2ba2813";
import "./plant/sim.js?v=4cf7090220";
import "./plant/tree.js?v=5cafb51d69";
import "./plant/pid.js?v=de308735ef";
import "./plant/faceplate.js?v=29fe79ffe3";
import "./plant/alarms.js?v=bbfb5174cf";
import "./plant/routing.js?v=15f4a83d4f";
import "./plant/actions.js?v=74dc10ebf2";
import "./plant/ui.js?v=a8bd0e8a96";
import { boot } from "./plant/main.js?v=2e27b8af88";

boot();
