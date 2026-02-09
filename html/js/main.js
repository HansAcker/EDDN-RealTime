/**
 * @module main
 * @description Application entry point. Initialises the EDDN WebSocket client,
 * wires up the activity icon, loads dashboard templates, creates dashboard
 * modules from the DOM, and starts the connection.
 */

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
	resetTimeout: Config.resetTimeout,

	// ReconnectingWebSocket handles transient connection errors
	WebSocketClass: ReconnectingWebSocket,

	// pass only a subset of messages to display modules
	filter: Config.globalEventFilter,
});
eddn.addEventListener("eddn:error", (event) => console.error(`EDDN error: ${event.message} - ${event.error}`));


// Reflect websocket activity in page icon
// TODO: quick succession of changes on load can get the displayed icon stuck on "idle"
//       - await ready before connect for now
const activity = new CachedPageIconActivity(window.icon, Config.idleTimeout);
eddn.addEventListener("open", () => activity.idle());
eddn.addEventListener("close", () => activity.off());
eddn.addEventListener("error", () => activity.error());
eddn.addEventListener("eddn:message", () => activity.ok()); // all valid messages passing the filter
eddn.addEventListener("eddn:error", () => activity.error()); // parse errors


// The module handler
const dashboard = new Dashboard(new MessageRouter(eddn), { container: document.querySelector(".dashboard") });


// TODO: dynamic imports etc., progress bar, "Loading..." animation


// block here until all loaded

// TODO: rethink. this is likely cargo-cult. `readyState` should never be "loading" in a module
//       - check for !== "complete"? `await dashboard.ready` almost certainly waits long enough, anyway
// wait for CSS to finish loading
if (document.readyState === "loading") {
	await new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
}

//await RegionMap.ready;
await CachedPageIconActivity.ready;

// TODO: would crash here if template load fails. catch and display error?
await dashboard.ready;

//document.querySelector(".dashboard__loader")?.remove();


console.debug("Main: load done");


// create modules from <div data-dashboard__module="...">
dashboard.fromContainer();

// create modules from names array
//dashboard.fromArray(["FSDJump", { name: "EventLog", options: { listLength: 100 }}]);

//dashboard.container.classList.remove("dashboard__loading");


eddn.connect();


console.debug("Main: init done");
