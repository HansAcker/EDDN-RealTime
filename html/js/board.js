import { ReconnectingWebSocket } from "./reconnecting-websocket.min.js";
import { ActivityIcon } from "./activity_icon.min.js";
import { StatsBox } from "./statsbox.min.js";
import { InfoBox } from "./infobox.min.js";

/* https://github.com/HansAcker/EDDN-RealTime */

// TODO: modularize


// TODO: move to inevitable utility module

// const distanceN = (v0, v1) => Math.hypot.apply(null, v0.map((v, i) => v - v1[i]));
const distance3 = (v0, v1) => Math.hypot(v0[0] - v1[0], v0[1] - v1[1], v0[2] - v1[2]); // subtract vectors, return length
const trimPrefix = (str, prefix) => (str.startsWith(prefix) ? str.slice(prefix.length) : str).trim();
const makeTd = (textContent) => { const td = document.createElement("td"); td.textContent = td.title = textContent; return td; };

function addRow(tbody, tr) {
	while (tbody.childElementCount >= listLength) {
		tbody.lastElementChild.remove();
	}

	tbody.prepend(tr);
}

function whatGame(data) {
	try {
		// no decision if gameversion is not set or set to CAPI-<endpoint>
		// https://github.com/EDCD/EDDN/blob/live/docs/Developers.md#gameversions-and-gamebuild
		const gameversion = data.header.gameversion;
		if (gameversion && (gameversion.startsWith("CAPI-Legacy-") || parseInt(gameversion) < 4)) {
			return "Legacy";
		}

		// https://github.com/EDCD/EDDN/blob/live/docs/Developers.md#horizons-and-odyssey-flags
		const msg = data.message;
		return msg.odyssey ? "Odyssey" : msg.horizons ? "Horizons" : msg.horizons === false ? "Base" : "Unknown";
	} catch(error) {
		console.log("gameversion error:", error);
		return "Unknown";
	}
}


const gameStats = new StatsBox(statstable.querySelector("tbody"), {
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


let lastEvent = Date.now();

const ws = new ReconnectingWebSocket(socketUrl);
const activity = new ActivityIcon(icon, idleTimeout);
const infobox = new InfoBox(document.body, infotemplate.content.children[0].cloneNode(true));

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

	const gameType = whatGame(data);
	gameStats.inc(gameType);

	const tr = document.createElement("tr");
	tr.classList.add("data");
	tr.classList.add(gameType);

	infobox.set(tr, data);

	// tr.title = data.header.softwareName;

	if (message.Taxi) {
		gameStats.inc("Taxi");
		tr.classList.add("taxi");
	}

	gameStats.set("TS", message.timestamp);

	try {
		const diff = new Date() - new Date(message.timestamp);
		if (diff > 3600 * 1000) { // timestamp older than 1h
			tr.classList.add("old");
			gameStats.inc("Old");
		}
		else if (diff < -180 * 1000) { // timestamp more than 3m ahead
			tr.classList.add("new");
			gameStats.inc("New");
		}
	} catch(error) {
		console.log("Invalid date:", error);
	}

	if (message.event) {
		gameStats.inc(message.event);

		if (message.event === "Scan") {
			tr.append(makeTd(message.BodyName), makeTd(message.ScanType));
			addRow(scanbods, tr);

			if (message.WasDiscovered === false && message.ScanType !== "NavBeaconDetail") {
				if (message.StarType) {
					const tr = document.createElement("tr");
					tr.classList.add("data");
					tr.classList.add(gameType);
					infobox.set(tr, data);
					tr.append(makeTd(message.BodyName), makeTd(`${message.StarType} ${message.Subclass}`));
					addRow(newstars, tr);
				}
				else if (message.PlanetClass) {
					const tr = document.createElement("tr");
					tr.classList.add("data");
					tr.classList.add(gameType);
					infobox.set(tr, data);
					tr.append(makeTd(message.BodyName),
						makeTd(message.PlanetClass),
						makeTd(message.AtmosphereType && message.AtmosphereType !== "None" ? message.AtmosphereType : ""),
						makeTd(message.Landable ? "Yes" : ""));
					addRow(newplanets, tr);
				}
			}
		}

		else if (message.event === "FSDJump") {
			tr.append(makeTd(message.StarSystem));
			addRow(jumps, tr);

			if (message.Population > 0 || message.SystemAllegiance) {
				const tr = document.createElement("tr");
				tr.classList.add("data");
				tr.classList.add(gameType);
				infobox.set(tr, data);

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
				addRow(visits, tr);
			}
		}

		else if (message.event === "NavRoute") {
			const route = message.Route || [];

			if (route.length > 1) {
				tr.append(makeTd(route[0].StarSystem),
					makeTd(route[route.length-1].StarSystem),
					makeTd(`${route.length-1}j`));

				try {
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

					tr.append(makeTd(route.length > 1 ? `${dist.toFixed(2)}ly` : ""));

					const td = makeTd(`${longest.toFixed(2)}ly`);
					if (longest >= 200) {
						td.classList.add("longjump");
					}
					tr.append(td);
				} catch(error) {
					console.log("Error in route:", error);
				}

				addRow(routes, tr);
			}
			else {
				console.log("Short NavRoute:", data);
			}
		}

		else if (message.event === "Docked" || message.event === "Location") {
			tr.append(makeTd(message.StationName || ""), makeTd(message.StationType || ""), makeTd(message.StarSystem));
			addRow(docks, tr);
		}

		else if (message.event === "ApproachSettlement") {
			tr.append(makeTd(message.Name), makeTd(message.StarSystem));
			addRow(asett, tr);
		}

		else if (message.event === "CodexEntry") {
			tr.append(makeTd(message.System),
				makeTd(trimPrefix(message.BodyName || "", message.System)),
				makeTd(message.SubCategory),
				makeTd(message.Name));
			addRow(codex, tr);
		}

		// TODO: FSSBodySignals, FSSSignalDiscovered, SAASignalsFound
		// TODO: DockingGranted, DockingDenied

		else {
			gameStats.inc("Ignored");
		}
	}
	else {
		// commodities, modules, ships

		tr.append(makeTd(message.commodities ? "Market" : message.ships ? "Shipyard" : message.modules ? "Outfitting" : ""),
			makeTd(message.stationName),
			makeTd(message.systemName));
		addRow(updates, tr);
	}
}


board.addEventListener("click", (ev) => {
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
