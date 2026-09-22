/* plant.js — Heuvelland plant HMI entry (ES modules). */
import "./plant/constants.js?v=c3ecb58217";
import "./plant/util.js?v=ed557b4951";
import "./plant/state.js?v=a9d2ba2813";
import "./plant/sim.js?v=4cf7090220";
import "./plant/tree.js?v=cfc9365578";
import "./plant/pid.js?v=de308735ef";
import "./plant/faceplate.js?v=a495f9bba3";
import "./plant/alarms.js?v=bbfb5174cf";
import "./plant/routing.js?v=15f4a83d4f";
import "./plant/actions.js?v=74dc10ebf2";
import "./plant/ui.js?v=e031fc21a0";
import { boot } from "./plant/main.js?v=2e27b8af88";

boot();
