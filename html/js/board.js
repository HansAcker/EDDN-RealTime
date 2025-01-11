import { ReconnectingWebSocket } from "./reconnecting-websocket.min.js";
import { PageIconActivity } from "./activity_icon.min.js";
import { StatsBox, SortedStatsBox } from "./statsbox.min.js";
import { InfoBox } from "./infobox.min.js";
import { distance3, trimPrefix, makeTd, addRow, whatGame, GalacticRegions } from "./utils.min.js";

// TODO: modularize
// TODO: remove/rework global config options (socketUrl, listLength, idleTimeout, resetTimeout)
// TODO: table-like block elements instead of tables would simplify things and allow smooth scrolling + animations


const activity = new PageIconActivity(window.icon, idleTimeout);
const infobox = new InfoBox(document.body, window.infotemplate.content.children[0]);
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


// TODO: unverified assumption: faster access
class MessageRecord {
	_data;
	_gameType;

	_schemaRef;
	_header;
	_message;

	_timestamp;
	_event;

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
function makeTr(messageRecord) {
	const tr = document.createElement("tr");

	tr.classList.add("data");
	tr.classList.add(messageRecord._gameType);

	if (messageRecord._isTaxi) {
		tr.classList.add("taxi");
	}

	if (messageRecord._isMulticrew) {
		tr.classList.add("multicrew");
	}

	if (messageRecord._isOld) {
		tr.classList.add("old");
	} else if (messageRecord._isNew) {
		tr.classList.add("new");
	}

	// key data by weak ref to table row, used in click event
	infobox.set(tr, messageRecord._data);

	return tr;
}


let lastEvent = Date.now();

const ws = new ReconnectingWebSocket(socketUrl);

ws.onopen = activity.idle;
ws.onclose = activity.off;

ws.onmessage = (event) => {
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
};

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

	const tbody = window.softbody;
	const oldCount = tbody.childElementCount;

	// TODO: group totals by softwareName, collapse individual versions
	const header = messageRecord._header;
	softwareStats.inc(`${header.softwareName} ${header.softwareVersion}`);

	// sort and replace the whole table if its element count changed
	if (tbody.childElementCount != oldCount) {
		tbody.replaceChildren(...[...tbody.children].sort((a, b) => a.children[0].textContent < b.children[0].textContent ? 1 : -1));
	}
}

function handleMessage(messageRecord) {
	if (messageRecord._event) {
		eventStats.inc(messageRecord._event);

		switch (messageRecord._event) {
			case "Scan": eventScan(messageRecord); break;

			case "FSDJump": eventFSDJump(messageRecord); break;

			case "NavRoute": eventNavRoute(messageRecord); break;

			case "Docked":
			case "Location": eventLocation(messageRecord); break;

			case "ApproachSettlement": eventApproachSettlement(messageRecord); break;

			case "CodexEntry": eventCodexEntry(messageRecord); break;

			// FSSDiscoveryScan, FSSAllBodiesFound, FSSBodySignals, FSSSignalDiscovered,
			// SAASignalsFound, ScanBaryCentre, NavBeaconScan,
			// DockingGranted, DockingDenied, FCMaterials, CarrierJump

			default:
				gameStats.inc("Ignored");
		}
	} else {
		// commodities, modules, ships
		const message = messageRecord._message;
		const tr = makeTr(messageRecord);

		tr.append(makeTd(message.commodities ? "Market" : message.ships ? "Shipyard" : message.modules ? "Outfitting" : ""),
			makeTd(message.stationName),
			makeTd(message.systemName));
		addRow(window.updates, tr);
	}
}

function eventScan(messageRecord) {
	const message = messageRecord._message;
	const tr = makeTr(messageRecord);

	tr.append(makeTd(message.BodyName), makeTd(message.ScanType));
	addRow(window.scanbods, tr);

	// some false positives slip through in pre-discovered systems
	if (message.WasDiscovered === false && message.WasMapped === false && message.ScanType !== "NavBeaconDetail") {
		if (message.StarType) {
			const tr = makeTr(messageRecord);
			tr.append(makeTd(message.BodyName), makeTd(`${message.StarType} ${message.Subclass}`));
			addRow(window.newstars, tr);
		}
		else if (message.PlanetClass) {
			const tr = makeTr(messageRecord);
			tr.append(makeTd(message.BodyName),
				makeTd(message.PlanetClass),
				makeTd(message.AtmosphereType && message.AtmosphereType !== "None" ? message.AtmosphereType : ""),
				makeTd(message.Landable ? "Yes" : ""));
			addRow(window.newplanets, tr);
		}
	}
}

function eventFSDJump(messageRecord) {
	const message = messageRecord._message;
	const tr = makeTr(messageRecord);

	tr.append(makeTd(message.StarSystem));
	addRow(window.jumps, tr);

	if (message.Population > 0 || message.SystemAllegiance) {
		const tr = makeTr(messageRecord);
		const faction = message.SystemFaction || {};
		tr.append(makeTd(message.StarSystem),
			makeTd(message.Population >= 1000000000 ? (message.Population / 1000000000).toFixed(2) + "G" :
				message.Population >= 1000000 ? (message.Population / 1000000).toFixed(2) + "M" :
				message.Population >= 1000 ? (message.Population / 1000).toFixed(2) + "k" :
				message.Population > 0 ? (message.Population / 1).toFixed(2) :
				""
			),
			makeTd(message.SystemAllegiance),
			makeTd(faction.Name || ""),
			makeTd(faction.FactionState || ""));
		addRow(window.visits, tr);
	}
}

function eventNavRoute(messageRecord) {
	const message = messageRecord._message;
	const route = message.Route || [];

	if (route.length > 1) {
		const tr = makeTr(messageRecord);
		tr.append(makeTd(route[0].StarSystem),
			makeTd(route[route.length-1].StarSystem),
			makeTd(`${route.length-1}j`));

		let dist = 0;
		let longest = 0;
		let cur;

		// sum jump distances
		for (const wp of route) {
			if (!cur) {
				// start system
				cur = wp.StarPos;
				// distance to destination system
				tr.append(makeTd(`${distance3(cur, route[route.length-1].StarPos).toFixed(2)}ly`));
				continue;
			}

			const hop = wp.StarPos;
			const range = distance3(cur, hop);

			if (maxrange < range) {
				maxrange = range;
				gameStats.set("Max jump range", `${range.toFixed(2)}ly`);
			}

			if (longest < range) {
				longest = range;
			}

			dist += range;
			cur = hop;
		}

		tr.append(makeTd(route.length > 2 ? `${dist.toFixed(2)}ly` : ""));

		const td = makeTd(`${longest.toFixed(2)}ly`);
		if (longest >= 200) {
			td.classList.add("longjump");
		}
		tr.append(td);

		addRow(window.routes, tr);
	} else {
		console.log("Short NavRoute:", messageRecord._data);
	}
}

function eventLocation(messageRecord) {
	const message = messageRecord._message;
	const tr = makeTr(messageRecord);

	tr.append(makeTd(message.StationName || ""), makeTd(message.StationType || ""), makeTd(message.StarSystem));

	addRow(window.docks, tr);
}

function eventApproachSettlement(messageRecord) {
	const message = messageRecord._message;
	const tr = makeTr(messageRecord);

	tr.append(makeTd(message.Name), makeTd(message.StarSystem));

	addRow(window.asett, tr);
}

function eventCodexEntry(messageRecord) {
	const message = messageRecord._message;
	const tr = makeTr(messageRecord);

	tr.append(makeTd(message.System),
		makeTd(trimPrefix(message.BodyName || "", message.System)), // strip system name from body name
		makeTd(message.SubCategory.replace(/^\$Codex_SubCategory_(.*);$/, "$1").replaceAll("_", " ")), // reformat keys
		makeTd(message.Name.replace(/^\$Codex_Ent_(.*)_Name;$/, "$1").replaceAll("_", " ")),
		makeTd(GalacticRegions[message.Region.replace(/^\$Codex_RegionName_(.*);$/, "$1")])); // look up region name from number

	addRow(window.codex, tr);
}


// TODO: move into infobox class?
window.board.addEventListener("click", (ev) => {
	let target;

	if (ev.target.tagName === "TR") {
		target = ev.target;
	}
	else if (ev.target.tagName === "TD") {
		target = ev.target.parentNode;
	}

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
