/* plant.js — Heuvelland plant HMI entry (ES modules). */
import "./plant/constants.js?v=f09ee01c08";
import "./plant/util.js?v=5e088b584c";
import "./plant/units.js?v=209fd75b9e";
import "./plant/state.js?v=855403491e";
import "./plant/sim.js?v=96a338be4f";
import "./plant/tree.js?v=39ebd03c55";
import "./plant/pid.js?v=b39989926c";
import "./plant/faceplate.js?v=e15b323034";
import "./plant/alarms.js?v=55a38f5a82";
import "./plant/routing.js?v=cd4b65525c";
import "./plant/actions.js?v=9082ce68a4";
import "./plant/ui.js?v=588b05e682";
import { boot } from "./plant/main.js?v=738586cbe6";

boot();
