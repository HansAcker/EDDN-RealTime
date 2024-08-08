import { ReconnectingWebSocket } from "./reconnecting-websocket.min.js";
import { ActivityIcon } from "./activity_icon.min.js";
import { StatsBox } from "./statsbox.min.js";
import { InfoBox } from "./infobox.min.js";
import { distance3, trimPrefix, makeTd, addRow, whatGame } from "./utils.min.js";

// TODO: modularize
// TODO: remove/rework global config options (socketUrl, listLength, idleTimeout, resetTimeout)
// TODO: extract tr creation/styling
// TODO: table-like block elements instead of tables would simplify things and allow smooth scrolling + animations


const activity = new ActivityIcon(window.icon, idleTimeout);
const infobox = new InfoBox(document.body, window.infotemplate.content.children[0]);
const gameStats = new StatsBox(window.statsbody, {
	"Total": 0,
	"Old": 0,
	"New": 0,
	"Ignored": 0,
	"Taxi": 0,
	"Base": 0,
	"Horizons": 0,
	"Odyssey": 0,
	"Legacy": 0,
	"Unknown": 0,
	"TS": "",
	"Max jump range": ""
});

let maxrange = 0;


class MessageRecord {
	data;
	gameType;

	timestamp;
	event;

	isTaxi;
	isOld;
	isNew;

	constructor(data) {
		this.data = data;
		this.gameType = whatGame(data);

		const message = data.message;

		this.timestamp = message.timestamp;
		this.event = message.event;

		this.isTaxi = !!message.taxi;

		const diff = new Date() - new Date(message.timestamp);
		this.isOld = (diff > 3600 * 1000); // timestamp older than 1h
		this.isNew = (diff < -180 * 1000); // timestamp more than 3m ahead
	}
}

// TODO: move into MessageRecord?
function makeTr(messageRecord) {
	const tr = document.createElement("tr");

	tr.classList.add("data");
	tr.classList.add(messageRecord.gameType);

	if (messageRecord.isTaxi) {
		tr.classList.add("taxi");
	}

	if (messageRecord.isOld) {
		tr.classList.add("old");
	} else if (messageRecord.isNew) {
		tr.classList.add("new");
	}

	infobox.set(tr, messageRecord.data);

	return tr;
}


let lastEvent = Date.now();

const ws = new ReconnectingWebSocket(socketUrl);

ws.onopen = activity.idle;
ws.onclose = activity.off;

ws.onmessage = (event) => {
	let data = {};

	try {
		data = JSON.parse(event.data);
	} catch(error) {
		console.log("JSON parse error:", error);
		activity.error();
		return;
	}

	const message = data.message;

	if (!message) {
		console.log("No message: ", data);
		activity.error();
		return;
	}

	activity.ok();
	lastEvent = Date.now();

	gameStats.inc("Total");

	const messageRecord = new MessageRecord(data);
	gameStats.inc(messageRecord.gameType);

	gameStats.set("TS", messageRecord.timestamp);

	if (messageRecord.isTaxi) {
		gameStats.inc("Taxi");
	}

	if (messageRecord.isOld) {
		gameStats.inc("Old");
	} else if (messageRecord.isNew) {
		gameStats.inc("New");
	}

	if (messageRecord.event) {
		gameStats.inc(messageRecord.event);

		switch (messageRecord.event) {
			case "Scan": {
				const tr = makeTr(messageRecord);

				tr.append(makeTd(message.BodyName), makeTd(message.ScanType));
				addRow(window.scanbods, tr);

				// some false positives slip through in pre-discovered systems
				if (message.WasDiscovered === false && message.ScanType !== "NavBeaconDetail") {
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
				break;
			}

			case "FSDJump": {
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
				break;
			}

			case "NavRoute": {
				const tr = makeTr(messageRecord);
				const route = message.Route || [];

				if (route.length > 1) {
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
				}
				else {
					console.log("Short NavRoute:", data);
				}
				break;
			}

			case "Docked":
			case "Location": {
				const tr = makeTr(messageRecord);
				tr.append(makeTd(message.StationName || ""), makeTd(message.StationType || ""), makeTd(message.StarSystem));
				addRow(window.docks, tr);
				break;
			}

			case "ApproachSettlement": {
				const tr = makeTr(messageRecord);
				tr.append(makeTd(message.Name), makeTd(message.StarSystem));
				addRow(window.asett, tr);
				break;
			}

			case "CodexEntry": {
				const tr = makeTr(messageRecord);
				tr.append(makeTd(message.System),
					makeTd(trimPrefix(message.BodyName || "", message.System)),
					makeTd(message.SubCategory),
					makeTd(message.Name));
				addRow(window.codex, tr);
				break;
			}

			// TODO: FSSBodySignals, FSSSignalDiscovered, SAASignalsFound
			// TODO: DockingGranted, DockingDenied

			default:
				gameStats.inc("Ignored");
		}
	}
	else {
		// commodities, modules, ships

		const tr = makeTr(messageRecord);
		tr.append(makeTd(message.commodities ? "Market" : message.ships ? "Shipyard" : message.modules ? "Outfitting" : ""),
			makeTd(message.stationName),
			makeTd(message.systemName));
		addRow(window.updates, tr);
	}
};


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
