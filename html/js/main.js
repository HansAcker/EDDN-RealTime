
import { ReconnectingWebSocket } from "ws/ReconnectingWebSocket.js";

import { EDDNClient } from "eddn/EDDNClient.js";
import { MessageRouter } from "eddn/MessageRouter.js";

import { RegionMap } from "ed/RegionMap.js";

import { PageIconActivity } from "ui/activity_icon.js";
import { InfoBox } from "ui/infobox.js";

import FSDJumpModule from "modules/FSDJumpModule.js";
import NavRouteModule from "modules/NavRouteModule.js";
import ScanModule from "modules/ScanModule.js";
import LocationModule from "modules/LocationModule.js";
import CodexEntryModule from "modules/CodexEntryModule.js";
import UpdatesModule from "modules/UpdatesModule.js";
import ApproachModule from "modules/ApproachModule.js";
import EventStatsModule from "modules/EventStatsModule.js";
import EventLogModule from "modules/EventLogModule.js";


console.debug("Main start");


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
	filter: (event) => (
//		(event.age < 0) || (event.isMulticrew) ||
//		(!event.StarSystem) || (!event.StarPos) ||
//		(event.StarSystem.startsWith("HIP ")) ||
//		(event.message?.Route?.some((wp) => wp?.StarSystem?.startsWith("HIP "))) ||
//		(event.StarPos && RegionMap.findRegion(...event.StarPos).id === 0) ||
//		(!event.StarPos || RegionMap.findRegion(...event.StarPos).id === 0) ||
		(event.StarPos && RegionMap.isReady && RegionMap.findRegion(...event.StarPos).id !== 18) ||
//		(event.StarPos && RegionMap.isReady && RegionMap.findRegion(...event.StarPos).name !== "Inner Orion Spur") ||
//		(event.StarPos && ["Perseus Arm", "The Abyss", "Elysian Shore"].includes(RegionMap.findRegion(...event.StarPos).name)) ||
//		(true)
		(false)
	),
});

eddn.connect();


// Reflect websocket activity in page icon
const activity = new PageIconActivity(window.icon, 2300);
eddn.addEventListener("open", () => activity.idle());
eddn.addEventListener("close", () => activity.off());
eddn.addEventListener("error", () => activity.error());
eddn.addEventListener("eddn:message", () => activity.ok()); // all valid messages passing the filter
eddn.addEventListener("eddn:error", () => activity.error()); // parse errors




// TODO: dynamic imports etc., progress bar, "Loading..." animation

// block here until RegionMapData loaded
await RegionMap.ready;

console.debug("Load done");




// TODO: - a Dashboard component that handles the modules, their containers and order
//       - save/load layout, config, etc.
//       - handle InfoBox

//const dashboard = new Dashboard(container, router, options);


// statically create and connect modules here for now
const router = new MessageRouter(eddn);
const modules = 
{
	"Jump": new FSDJumpModule(router, window.board.querySelector(".dashboard__module--jumps .dashboard__table--tbody"), infobox),
	"Route": new NavRouteModule(router, window.board.querySelector(".dashboard__module--routes .dashboard__table--tbody"), infobox),
	"Scan": new ScanModule(router, window.board.querySelector(".dashboard__module--scanbods .dashboard__table--tbody"), infobox),
	"Location": new LocationModule(router, window.board.querySelector(".dashboard__module--locations .dashboard__table--tbody"), infobox),
	"Codex": new CodexEntryModule(router, window.board.querySelector(".dashboard__module--codex .dashboard__table--tbody"), infobox),
	"Updates": new UpdatesModule(router, window.board.querySelector(".dashboard__module--updates .dashboard__table--tbody"), infobox),
	"Approach": new ApproachModule(router, window.board.querySelector(".dashboard__module--asett .dashboard__table--tbody"), infobox),

	"EventLog": new EventLogModule(router, window.board.querySelector(".dashboard__module--log .dashboard__table--tbody"), infobox, { listLength: 30 }),

	// no infobox
	"EventStats": new EventStatsModule(router, window.board.querySelector(".dashboard__module--events .dashboard__table--tbody")),
};


console.debug("Init done");
