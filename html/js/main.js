
import { EDDNClient } from "#eddn/EDDNClient.js";
import { MessageRouter } from "#eddn/MessageRouter.js";

// import { RegionMap } from "#ed/RegionMap.js";

import { ReconnectingWebSocket } from "#ws/ReconnectingWebSocket.js";

import { CachedPageIconActivity } from "#ui/activity_icon.js";
import { InfoBox } from "#ui/infobox.js";

import FSDJumpModule from "#modules/FSDJumpModule.js";
import NavRouteModule from "#modules/NavRouteModule.js";
import ScanModule from "#modules/ScanModule.js";
import LocationModule from "#modules/LocationModule.js";
import CodexEntryModule from "#modules/CodexEntryModule.js";
import UpdatesModule from "#modules/UpdatesModule.js";
import ApproachModule from "#modules/ApproachModule.js";
import EventStatsModule from "#modules/EventStatsModule.js";
import EventLogModule from "#modules/EventLogModule.js";
import VisitsModule from "#modules/VisitsModule.js";
import NewStarsModule from "#modules/NewStarsModule.js";
import NewBodiesModule from "#modules/NewBodiesModule.js";


console.debug("Main: start");


// Data window
const infobox = new InfoBox(document.body, window.infotemplate);
window.board.addEventListener("click", (ev) => {
	const target = ev.target.closest(".data");

	if (target && infobox.has(target)) {
		infobox.show(target);
	}
});


// The EDDN event bus
const eddn = new EDDNClient({
	url: "wss://ws.eddn-realtime.space/eddn",

	// reset websocket connection after 5min without messages
	resetTimeout: 300 * 1000,

	// ReconnectingWebSocket handles transient connection errors
	WebSocketClass: ReconnectingWebSocket,

	// pass only a subset of messages to display modules
	// TODO: remove global defined in index.html. something else?
	filter: (typeof globalEventFilter === "function" ? globalEventFilter : null), // eslint-disable-line no-undef
});

eddn.connect();


// Reflect websocket activity in page icon
const activity = new CachedPageIconActivity(window.icon, 2300);
eddn.addEventListener("open", () => activity.idle());
eddn.addEventListener("close", () => activity.off());
eddn.addEventListener("error", () => activity.error());
eddn.addEventListener("eddn:message", () => activity.ok()); // all valid messages passing the filter
eddn.addEventListener("eddn:error", () => activity.error()); // parse errors


// TODO: dynamic imports etc., progress bar, "Loading..." animation

// block here until all loaded
// await RegionMap.ready;
// await CachedPageIconActivity.ready;

// wait for CSS to finish loading
if (document.readyState === "loading") {
	await new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
}


console.debug("Main: load done");




// TODO: - a Dashboard component that handles the modules, their containers and order
//       - save/load layout, config, etc.
//       - handle InfoBox

//const dashboard = new Dashboard(container, router, options);

/*
for (const el of window.board.querySelectorAll("[data-dashboard__module]")) {
	console.log(el.dataset.dashboard__module, JSON.parse(String(el.dataset.dashboard__options ?? "{}")));
}
*/


// statically create and connect modules here for now
const router = new MessageRouter(eddn);
const options = { infobox, listLength: 20 };

const _modules = // eslint-disable-line no-unused-vars
[
	new FSDJumpModule(router, window.FSDJump, { ...options, template: window.FSDJumpTemplate }),
	new NavRouteModule(router, window.NavRoute, { ...options, template: window.NavRouteTemplate }),
	new ScanModule(router, window.Scan, { ...options, template: window.ScanTemplate }),
	new LocationModule(router, window.Docks, { ...options, template: window.LocationTemplate }),
	new CodexEntryModule(router, window.CodexEntry, { ...options, template: window.CodexEntryTemplate }),
	new UpdatesModule(router, window.Updates, { ...options, template: window.UpdatesTemplate }),
	new ApproachModule(router, window.Approach, { ...options, template: window.ApproachTemplate }),
	new VisitsModule(router, window.Visits, { ...options, template: window.VisitsTemplate }),
	new NewStarsModule(router, window.NewStars, { ...options, template: window.NewStarsTemplate }),
	new NewBodiesModule(router, window.NewBodies, { ...options, template: window.NewBodiesTemplate }),

	new EventLogModule(router, window.EventLog, { ...options, template: window.EventLogTemplate, listLength: 30 }),

	// no infobox
	new EventStatsModule(router, window.EventStats, { template: window.EventStatsTemplate }),
];

console.debug("Main: init done");
