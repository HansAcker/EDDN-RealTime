
import { EDDNClient } from "#eddn/EDDNClient.js";
import { MessageRouter } from "#eddn/MessageRouter.js";

import { RegionMap } from "#ed/RegionMap.js";

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
// import { DashboardModule } from "#DashboardModule";


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
await RegionMap.ready;
// await CachedPageIconActivity.ready;

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
{
//	"Jump": new FSDJumpModule(router, window.jumps, options),
	"Jump": new FSDJumpModule(router, window.FSDJump, { template: window.FSDJumpTemplate, ...options }),
	"Route": new NavRouteModule(router, window.NavRoute, { template: window.NavRouteTemplate, ...options }),
	"Scan": new ScanModule(router, window.Scan, { template: window.ScanTemplate, ...options }),
	"Location": new LocationModule(router, window.Docks, { template: window.LocationTemplate, ...options }),
	"Codex": new CodexEntryModule(router, window.CodexDiscoveries, { template: window.CodexDiscoveriesTemplate, ...options }),
	"Updates": new UpdatesModule(router, window.Updates, { template: window.UpdatesTemplate, ...options }),
	"Approach": new ApproachModule(router, window.Approach, { template: window.ApproachTemplate, ...options }),
	"Visits": new VisitsModule(router, window.Visits, { template: window.VisitsTemplate, ...options }),
	"NewStars": new NewStarsModule(router, window.NewStars, { template: window.NewStarsTemplate, ...options }),
	"NewBodies": new NewBodiesModule(router, window.NewBodies, { template: window.NewBodiesTemplate, ...options }),

	"EventLog": new EventLogModule(router, window.EventLog, { template: window.EventLogTemplate, ...options }),

	// no infobox
	"EventStats": new EventStatsModule(router, window.eventsbody),
};

console.debug("Main: init done");
