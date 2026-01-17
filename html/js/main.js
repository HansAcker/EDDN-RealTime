
import { Config } from "#config.js";

import { EDDNClient } from "#eddn/EDDNClient.js";
import { MessageRouter } from "#eddn/MessageRouter.js";
import { Dashboard } from "#board/Dashboard.js";
import { ReconnectingWebSocket } from "#ws/ReconnectingWebSocket.js";
import { CachedPageIconActivity } from "#ui/activity_icon.js";
// import { RegionMap } from "#ed/RegionMap.js";


console.debug("Main: start");


// The EDDN event bus
const eddn = new EDDNClient({
	url: Config.websocket_url,

	// reset websocket connection after 5min without messages
	resetTimeout: Config.resetTimeout,

	// ReconnectingWebSocket handles transient connection errors
	WebSocketClass: ReconnectingWebSocket,

	// pass only a subset of messages to display modules
	filter: Config.globalEventFilter,
});


// The module handler
const dashboard = new Dashboard(new MessageRouter(eddn), { container: window.board });


// Reflect websocket activity in page icon
// TODO: quick succession of changes on load can get the displayed icon stuck on "idle"
//       - await ready before connect for now
const activity = new CachedPageIconActivity(window.icon, 2300);
eddn.addEventListener("open", () => activity.idle());
eddn.addEventListener("close", () => activity.off());
eddn.addEventListener("error", () => activity.error());
eddn.addEventListener("eddn:message", () => activity.ok()); // all valid messages passing the filter
eddn.addEventListener("eddn:error", () => activity.error()); // parse errors


// TODO: dynamic imports etc., progress bar, "Loading..." animation

// block here until all loaded
//await RegionMap.ready;
await CachedPageIconActivity.ready;

// TODO: would crash here if template load fails. catch and display error?
await dashboard.ready;
dashboard.fromContainer();
//dashboard.fromArray([{ name: "EventLog", options: { listLength: 100 }}]);
//document.body.replaceChildren(dashboard.container);

// wait for CSS to finish loading
if (document.readyState === "loading") {
	await new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
}


console.debug("Main: load done");


eddn.connect();


console.debug("Main: init done");
