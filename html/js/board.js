// html/js/board.js
import { ReconnectingWebSocket } from "./reconnecting-websocket.js";
import { PageIconActivity } from "./activity_icon.js";
import { StatsBox, SortedStatsBox } from "./statsbox.js";
import { InfoBox } from "./infobox.js";
import { distance3, trimPrefix, makeCell, addRow, whatGame, GalacticRegions } from "./utils.js";

// TODO: modularize
// TODO: remove/rework global config options (socketUrl, listLength, idleTimeout, resetTimeout)
// TODO: table-like block elements instead of tables would simplify things and allow smooth scrolling + animations


const activity = new PageIconActivity(window.icon, idleTimeout);
const infobox = new InfoBox(document.body, window.infotemplate);
const softwareStats = new StatsBox(window.softbody);
const eventStats = new SortedStatsBox(window.eventsbody);
const gameStats = new StatsBox(window.statsbody, {
	"Total": 0,
	"Odyssey": 0,
	"Horizons": 0,
	"Base": 0,
	"Legacy": 0,
	"Unknown": 0,
	"Taxi": 0,
	"Multicrew": 0,
	"Old": 0,
	"New": 0,
	"Ignored": 0,
	"Last timestamp": "",
	"Max jump range": ""
});

let maxrange = 0;


// TODO: unverified assumption: faster access by hoisting references from potentially megamorphic "data" into fixed properties
// TODO: use lazy getters?
class MessageRecord {
	_data;

	_schemaRef;
	_header;
	_message;

	_timestamp;
	_event;

	_gameType;

	_isTaxi;
	_isMulticrew;

	_isOld;
	_isNew;

	constructor(data) {
		this._data = data;
		this._gameType = whatGame(data);

		const message = data.message;

		this._schemaRef = data.$schemaRef;
		this._header = data.header;
		this._message = message;

		this._timestamp = message.timestamp;
		this._event = message.event;

		this._isTaxi = !!message.Taxi;
		this._isMulticrew = !!message.Multicrew;

		const diff = new Date() - new Date(message.timestamp);
		this._isOld = (diff > 3600 * 1000); // timestamp older than 1h
		this._isNew = (diff < -180 * 1000); // timestamp more than 3m ahead
	}
}

// TODO: move into MessageRecord? uses global infobox
function makeRow(messageRecord) {
	const div = document.createElement("div");

	div.classList.add("row");
	div.classList.add("data");
	div.classList.add(messageRecord._gameType);

	if (messageRecord._isTaxi) {
		div.classList.add("taxi");
	}

	if (messageRecord._isMulticrew) {
		div.classList.add("multicrew");
	}

	if (messageRecord._isOld) {
		div.classList.add("old");
	} else if (messageRecord._isNew) {
		div.classList.add("new");
	}

	// key data by weak ref to table row, used in click event
	infobox.set(div, messageRecord._data);

	return div;
}


let lastEvent = Date.now();

const ws = new ReconnectingWebSocket(socketUrl);

ws.addEventListener("open",activity.idle);
ws.addEventListener("close", activity.off);

ws.addEventListener("message", (event) => {
	let data;

	try {
		data = JSON.parse(event.data);

		// TODO: check typeof === "object"?
		if (!(data.$schemaRef && data.header && data.message)) {
			console.log("Invalid message:", data);
			activity.error();
			return;
		}
	} catch(error) {
		console.log("JSON object error:", error, data);
		activity.error();
		return;
	}

	activity.ok();
	lastEvent = Date.now();

	const messageRecord = new MessageRecord(data);
	// TODO: use $schemaRef to select modules

	updateGameStats(messageRecord);
	updateSoftwareStats(messageRecord);

	handleMessage(messageRecord);
});

function updateGameStats(messageRecord) {
	gameStats.set("Last timestamp", messageRecord._timestamp);
	gameStats.inc("Total");
	gameStats.inc(messageRecord._gameType);

	if (messageRecord._isTaxi) {
		gameStats.inc("Taxi");
	}

	if (messageRecord._isMulticrew) {
		gameStats.inc("Multicrew");
	}

	if (messageRecord._isOld) {
		gameStats.inc("Old");
	} else if (messageRecord._isNew) {
		gameStats.inc("New");
	}
}

function updateSoftwareStats(messageRecord) {
	// TODO: this should go into SortedStatsBox and insert new tr in the right position

	// TODO: group totals by softwareName, collapse individual versions
	const header = messageRecord._header;
	const tag = `${header.softwareName} ${header.softwareVersion}`;

	// sort and replace the whole table if its element count changed
	const needsort = !softwareStats.has(tag);

	softwareStats.inc(tag);

	if (needsort) {
		const tbody = window.softbody;
		tbody.replaceChildren(...[...tbody.children].sort((a, b) => b.children[0].textContent.localeCompare(a.children[0].textContent)));
	}
}

function handleMessage(messageRecord) {
	if (messageRecord._event) {
		eventStats.inc(messageRecord._event);
		(EDDNEventHandlers[messageRecord._event] ?? eventIgnored)(messageRecord);
	} else {
		eventDefault(messageRecord);
	}
}

const EDDNEventHandlers = {
	"Scan": eventScan,
	"FSDJump": eventFSDJump,
	"NavRoute": eventNavRoute,
	"Docked": eventLocation,
	"Location": eventLocation,
	"ApproachSettlement": eventApproachSettlement,
	"CodexEntry": eventCodexEntry,

	// FSSDiscoveryScan, FSSAllBodiesFound, FSSBodySignals, FSSSignalDiscovered,
	// SAASignalsFound, ScanBaryCentre, NavBeaconScan,
	// DockingGranted, DockingDenied, FCMaterials, CarrierJump
}

function eventIgnored(messageRecord) {
	gameStats.inc("Ignored");
}

function eventDefault(messageRecord) {
	// commodities, modules, ships
	const message = messageRecord._message;
	const row = makeRow(messageRecord);

	row.append(makeCell(message.commodities ? "Market" : message.ships ? "Shipyard" : message.modules ? "Outfitting" : ""),
		makeCell(message.stationName),
		makeCell(message.systemName));
	addRow(window.updates, row);
}

function eventScan(messageRecord) {
	const message = messageRecord._message;
	const row = makeRow(messageRecord);

	row.append(makeCell(message.BodyName), makeCell(message.ScanType));
	addRow(window.scanbods, row);

	// some false positives slip through in pre-discovered systems
	if (message.WasDiscovered === false && message.WasMapped === false && message.ScanType !== "NavBeaconDetail") {
		if (message.StarType) {
			const row = makeRow(messageRecord);
			row.append(makeCell(message.BodyName), makeCell(`${message.StarType} ${message.Subclass}`));
			addRow(window.newstars, row);
		}
		else if (message.PlanetClass) {
			const row = makeRow(messageRecord);
			row.append(makeCell(message.BodyName),
				makeCell(message.PlanetClass),
				makeCell(message.AtmosphereType && message.AtmosphereType !== "None" ? message.AtmosphereType : ""),
				makeCell(message.Landable ? "Yes" : ""));
			addRow(window.newplanets, row);
		}
	}
}

function eventFSDJump(messageRecord) {
	const message = messageRecord._message;
	const row = makeRow(messageRecord);

	row.append(makeCell(message.StarSystem));
	addRow(window.jumps, row);

	if (message.Population > 0 || message.SystemAllegiance) {
		const row = makeRow(messageRecord);
		const faction = message.SystemFaction ?? {};
		row.append(makeCell(message.StarSystem),
			// TODO: use Intl.NumberFormat?
			makeCell(message.Population >= 1000000000 ? (message.Population / 1000000000).toFixed(2) + "G" :
				message.Population >= 1000000 ? (message.Population / 1000000).toFixed(2) + "M" :
				message.Population >= 1000 ? (message.Population / 1000).toFixed(2) + "k" :
				message.Population > 0 ? (message.Population / 1).toFixed(2) :
				""
			),
			makeCell(message.SystemAllegiance),
			makeCell(faction.Name ?? ""),
			makeCell(faction.FactionState ?? ""));
		addRow(window.visits, row);
	}
}

function eventNavRoute(messageRecord) {
	const message = messageRecord._message;
	const route = message.Route ?? [];

	if (route.length > 1) {
		const row = makeRow(messageRecord);
		row.append(makeCell(route[0].StarSystem),
			makeCell(route[route.length-1].StarSystem),
			makeCell(`${route.length-1}j`));

		let dist = 0;
		let longest = 0;

		if (route.length === 2) {
			// single-jump route

			dist = longest = distance3(route[0].StarPos, route[1].StarPos);
			row.append(makeCell(`${dist.toFixed(2)}ly`), makeCell(""));
		} else {
			// sum jump distances

			let cur;
			for (const wp of route) {
				if (!cur) {
					// start system
					cur = wp.StarPos;
					// distance to destination system
					row.append(makeCell(`${distance3(cur, route[route.length-1].StarPos).toFixed(2)}ly`));
					continue;
				}

				const hop = wp.StarPos;
				const range = distance3(cur, hop);

				if (longest < range) {
					longest = range;
				}

				dist += range;
				cur = hop;
			}

			row.append(makeCell(`${dist.toFixed(2)}ly`));
		}

		// update the record
		if (maxrange < longest) {
			maxrange = longest;
			gameStats.set("Max jump range", `${longest.toFixed(2)}ly`);
		}

		const cell = makeCell(`${longest.toFixed(2)}ly`);
		if (longest >= 200) {
			cell.classList.add("longjump");
		}
		row.append(cell);

		addRow(window.routes, row);
	} else {
		console.log("Short NavRoute:", messageRecord._data);
	}
}

function eventLocation(messageRecord) {
	const message = messageRecord._message;
	const row = makeRow(messageRecord);

	row.append(makeCell(message.StationName ?? ""), makeCell(message.StationType ?? ""), makeCell(message.StarSystem));

	addRow(window.docks, row);
}

function eventApproachSettlement(messageRecord) {
	const message = messageRecord._message;
	const row = makeRow(messageRecord);

	row.append(makeCell(message.Name), makeCell(message.StarSystem));

	addRow(window.asett, row);
}

function eventCodexEntry(messageRecord) {
	const message = messageRecord._message;
	const row = makeRow(messageRecord);

	row.append(makeCell(message.System),
		makeCell(trimPrefix(message.BodyName ?? "", message.System)), // strip system name from body name
		makeCell(message.SubCategory.replace(/^\$Codex_SubCategory_(.*);$/, "$1").replaceAll("_", " ")), // reformat keys
		makeCell(message.Name.replace(/^\$Codex_Ent_(.*)_Name;$/, "$1").replaceAll("_", " ")),
		makeCell(GalacticRegions[message.Region.replace(/^\$Codex_RegionName_(.*);$/, "$1")])); // look up region name from number

	addRow(window.codex, row);
}


// TODO: move into infobox class?
window.board.addEventListener("click", (ev) => {
	const target = ev.target.closest(".data");

	if (target && infobox.has(target)) {
		infobox.show(target);
	}
});


(function watchdog() {
	if (ws.readyState === WebSocket.OPEN && Date.now() - lastEvent > resetTimeout) {
		console.log("Receive timeout. Resetting connection.");
		ws.refresh();
	}

	const nextWake = ~~(60000 + Math.random() * 42000);
	//console.log(`Sleeping for ${nextWake}ms`);

	setTimeout(watchdog, nextWake);
})();
