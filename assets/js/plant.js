/* plant.js — Heuvelland plant HMI entry (ES modules). */
import "./plant/constants.js?v=b1ceabaaf4";
import "./plant/util.js?v=bf11540763";
import "./plant/state.js?v=a9d2ba2813";
import "./plant/sim.js?v=4cf7090220";
import "./plant/tree.js?v=5cafb51d69";
import "./plant/pid.js?v=09d14e81a4";
import "./plant/faceplate.js?v=29fe79ffe3";
import "./plant/alarms.js?v=bbfb5174cf";
import "./plant/routing.js?v=15f4a83d4f";
import "./plant/actions.js?v=74dc10ebf2";
import "./plant/ui.js?v=f1416727d6";
import { boot } from "./plant/main.js?v=2e27b8af88";

boot();
