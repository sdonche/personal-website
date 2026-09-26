/* plant.js — Heuvelland plant HMI entry (ES modules). */
import "./plant/constants.js?v=3343b23463";
import "./plant/util.js?v=aee3c3289b";
import "./plant/units.js?v=209fd75b9e";
import "./plant/state.js?v=b8a8bd17d4";
import "./plant/sim.js?v=947fcde50b";
import "./plant/tree.js?v=39ebd03c55";
import "./plant/pid.js?v=b39989926c";
import "./plant/faceplate.js?v=7601dbd7d9";
import "./plant/alarms.js?v=d9e1130e85";
import "./plant/routing.js?v=cd4b65525c";
import "./plant/actions.js?v=3f117dab71";
import "./plant/ui.js?v=ae9ec24ce0";
import { boot } from "./plant/main.js?v=738586cbe6";

boot();
