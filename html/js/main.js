import { ReconnectingWebSocket } from "ReconnectingWebSocket";

import { EDDNClient } from "eddn/EDDNClient.js";
import { MessageRouter } from "eddn/MessageRouter.js";

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


// Data window
const infobox = new InfoBox(document.body, window.infotemplate);
window.board.addEventListener("click", (ev) => {
	const target = ev.target.closest(".data");

	if (target && infobox.has(target)) {
		infobox.show(target);
	}
});


// The EDDN event bus
const client = new EDDNClient({
	url: "wss://ws.eddn-realtime.space/eddn",

	// reset websocket connection after 5min without messages
	resetTimeout: 300 * 1000,

	// ReconnectingWebSocket handles transient connection errors
	WebSocketClass: ReconnectingWebSocket,

/*
	// pass only a subset of messages to display modules
	filter: (event) => {
		return  (event.message?.StarSystem ?? event.message?.systemName)?.startsWith("HIP ") ||
				(event.message?.Route?.some((wp) => wp?.StarSystem?.startsWith("HIP "))) ||
				(event.age <= 0) || (event.isTaxi)
	},
*/
});

const router = new MessageRouter(client);

client.connect();


// Reflect websocket activity in page icon
const activity = new PageIconActivity(window.icon, 2300);
client.addEventListener("open", () => activity.idle());
client.addEventListener("close", () => activity.off());
client.addEventListener("error", () => activity.error());
client.addEventListener("eddn:message", () => activity.ok()); // all valid messages passing the filter
client.addEventListener("eddn:error", () => activity.error()); // parse errors


// Initialize Modules
// They attach their own listeners
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
