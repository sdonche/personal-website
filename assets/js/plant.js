/* plant.js — Heuvelland plant HMI entry (ES modules). */
import "./plant/constants.js?v=47c625ec24";
import "./plant/util.js?v=3298ffd61f";
import "./plant/units.js?v=0702ef65e2";
import "./plant/oee.js?v=0f3b8034bf";
import "./plant/state.js?v=9eee36e43f";
import "./plant/sim.js?v=1abe81fb76";
import "./plant/tree.js?v=39ebd03c55";
import "./plant/pid.js?v=b39989926c";
import "./plant/faceplate.js?v=1233f2e410";
import "./plant/alarms.js?v=5755a01b4a";
import "./plant/routing.js?v=5836209ebf";
import "./plant/actions.js?v=ccbdbba81b";
import "./plant/ui.js?v=22a351381d";
import "./plant/tour.js?v=b2d04abd9a";
import { boot } from "./plant/main.js?v=905845d1f8";

boot();
