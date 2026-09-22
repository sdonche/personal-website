/* plant.js — Heuvelland plant HMI entry (ES modules). */
import "./plant/constants.js?v=60bb326ea6";
import "./plant/util.js?v=d8269b8411";
import "./plant/state.js?v=a9d2ba2813";
import "./plant/sim.js?v=4ce81c4d08";
import "./plant/tree.js?v=cfc9365578";
import "./plant/pid.js?v=dbae1f1c0a";
import "./plant/faceplate.js?v=85aec957ec";
import "./plant/alarms.js?v=1fc53d3b16";
import "./plant/routing.js?v=15f4a83d4f";
import "./plant/actions.js?v=74dc10ebf2";
import "./plant/ui.js?v=a1084e8b3e";
import { boot } from "./plant/main.js?v=2e27b8af88";

boot();
