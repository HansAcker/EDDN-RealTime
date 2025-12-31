import { ReconnectingWebSocket } from "ReconnectingWebSocket";

import { PageIconActivity } from "ui/activity_icon.js";
import { InfoBox } from "ui/infobox.js";

import { EDDNClient } from "EDDNClient";
import { EDDNEvent } from "EDDNEvent";

//import { DashboardModule, DataTableModule } from "modules/DashboardModule.js";
import FSDJumpModule from "modules/FSDJumpModule.js";
import NavRouteModule from "modules/NavRouteModule.js";
import ScanModule from "modules/ScanModule.js";
import LocationModule from "modules/LocationModule.js";
import CodexEntryModule from "modules/CodexEntryModule.js";
import UpdatesModule from "modules/UpdatesModule.js";
import ApproachModule from "modules/ApproachModule.js";
import EventStatsModule from "modules/EventStatsModule.js";


// Data window
const infobox = new InfoBox(document.body, window.infotemplate);
window.board.addEventListener("click", (ev) => {
	const target = ev.target.closest(".data");

	if (target && infobox.has(target)) {
		infobox.show(target);
	}
});


// The EDDN event bus
const client = new EDDNClient("wss://ws.eddn-realtime.space/eddn", { WebSocketClass: ReconnectingWebSocket });


// Reflect websocket activity in page icon
const activity = new PageIconActivity(window.icon, 2300);
client.addEventListener("open", () => activity.idle());
client.addEventListener("close", () => activity.off());
client.addEventListener("error", () => activity.error());
//client.addEventListener("eddn:message", () => activity.ok()); // only called if not filtered
client.addEventListener("eddn:filter", () => activity.ok()); // called for all messages
client.addEventListener("eddn:error", () => activity.error()); // called for message parse errors


/*
// Filter the data feed
client.addEventListener("eddn:filter", (ev) => {
	if (!(ev.message?.StarSystem?.startsWith("Lalande ") || ev.message?.Route?.some((wp) => wp?.StarSystem?.startsWith("Lalande ")))) {
		ev.preventDefault();
	}

	// possibly modify ev.message here before it is passed to modules
});
*/


// Initialize Modules
// They attach their own listeners
const modules = 
{
	"Jump": new FSDJumpModule(client, window.board.querySelector(".dashboard__module--jumps .dashboard__table--tbody"), infobox),
	"Route": new NavRouteModule(client, window.board.querySelector(".dashboard__module--routes .dashboard__table--tbody"), infobox),
	"Scan": new ScanModule(client, window.board.querySelector(".dashboard__module--scanbods .dashboard__table--tbody"), infobox),
	"Location": new LocationModule(client, window.board.querySelector(".dashboard__module--locations .dashboard__table--tbody"), infobox),
	"Codex": new CodexEntryModule(client, window.board.querySelector(".dashboard__module--codex .dashboard__table--tbody"), infobox),
	"Updates": new UpdatesModule(client, window.board.querySelector(".dashboard__module--updates .dashboard__table--tbody"), infobox),
	"Approach": new ApproachModule(client, window.board.querySelector(".dashboard__module--asett .dashboard__table--tbody"), infobox),

	// no infobox
	"EventStats": new EventStatsModule(client, window.board.querySelector(".dashboard__module--events .dashboard__table--tbody")),
};


client.connect();


/*
{
import { SchemaValidator } from "./SchemaValidator.js";

const validator = new SchemaValidator();

const eddn_schema_files = {
	"approachsettlement": "/schemas/approachsettlement-v1.0.json",
	"blackmarket": "/schemas/blackmarket-v1.0.json",
	"codexentry": "/schemas/codexentry-v1.0.json",
	"commodity": "/schemas/commodity-v3.0.json",
	"dockingdenied": "/schemas/dockingdenied-v1.0.json",
	"dockinggranted": "/schemas/dockinggranted-v1.0.json",
	"fcmaterials_capi": "/schemas/fcmaterials_capi-v1.0.json",
	"fcmaterials_journal": "/schemas/fcmaterials_journal-v1.0.json",
	"fssallbodiesfound": "/schemas/fssallbodiesfound-v1.0.json",
	"fssbodysignals": "/schemas/fssbodysignals-v1.0.json",
	"fssdiscoveryscan": "/schemas/fssdiscoveryscan-v1.0.json",
	"fsssignaldiscovered": "/schemas/fsssignaldiscovered-v1.0.json",
	"journal": "/schemas/journal-v1.0.json",
	"navbeaconscan": "/schemas/navbeaconscan-v1.0.json",
	"navroute": "/schemas/navroute-v1.0.json",
	"outfitting": "/schemas/outfitting-v2.0.json",
	"scanbarycentre": "/schemas/scanbarycentre-v1.0.json",
	"shipyard": "/schemas/shipyard-v2.0.json",
}

const eddn_schemas = {}

// import JSON schema data
const imports = [];
for (const schema_name in eddn_schema_files) {
	imports.push(new Promise((resolve) => {
		import(eddn_schema_files[schema_name], { with: { type: "json" } })
		.then((result) => {
			const schema = result.default;
			eddn_schemas[schema_name] = schema;
			validator.addSchema(schema_name, schema);
			resolve();
		})
		.catch((error) => {
			//console.error("import error:", schema_name, error);
			resolve({schema_name, error});
		})
	}));
}

console.log((await Promise.all(imports)).filter(val => val));

client.addEventListener("eddn:message", (ev) => {
*/
//	const schema_name = EDDNEvent.getEventType(ev.data).replace(/:.*/, "");
/*
	if (schema_name in eddn_schemas) {
		const val_result = validator.validate(schema_name, ev.data);
		if (!val_result.valid) {
			console.log("validation errors:", val_result.errors);
		}
	} else {
		console.log("No schema for", schema_name, ev.$schemaRef, ev.data);
	}
});
}
*/

