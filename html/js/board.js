"use strict";
import { ReconnectingWebSocket } from "/js/reconnecting-websocket.min.js";

/* https://github.com/HansAcker/EDDN-RealTime */

const socketUrl = "wss://ws.eddn-realtime.space/eddn";
const listLength = 20;


// const distanceN = (v0, v1) => Math.hypot.apply(null, v0.map((v, i) => v - v1[i]));
const distance3 = (v0, v1) => Math.hypot(v0[0] - v1[0], v0[1] - v1[1], v0[2] - v1[2]); // subtract vectors, return length
const trimPrefix = (str, prefix) => (str.startsWith(prefix) ? str.slice(prefix.length) : str).trim();
const whatGame = (msg) => msg.odyssey ? "Odyssey" : msg.horizons ? "Horizons" : msg.horizons === false ? "Base" : "Unknown";
const makeTd = (textContent) => { const td = document.createElement("td"); td.textContent = textContent; return td; };

function addRow(tbody, tr) {
	while (tbody.children.length >= listLength) {
		tbody.removeChild(tbody.lastChild);
	}

	tbody.insertBefore(tr, tbody.firstChild);
}


const gameStats = {
	"Total": 0,
	"Old": 0,
	"New": 0,
	"Ignored": 0,
	"Taxi": 0,
	"Base": 0,
	"Horizons": 0,
	"Odyssey": 0,
	"Unknown": 0,
	"TS": "",
	"Max jump range": ""
};

let statsbody = statstable.querySelector("tbody");

let maxrange = 0;
let lastEvent = Date.now();


const icons = {
	"ok": "img/led-circle-green.png",
	"off": "img/led-circle-red.png",
	"idle": "img/led-circle-grey.png",
	"error": "img/led-circle-yellow.png"
};

let timer = null;
let lastState = "";

const idle = () => { lastState = "idle"; icon.href = icons["idle"]; timer = null; }

function setActivity(state, timeout = 0) {
	if (timer) {
		clearTimeout(timer);
		timer = null;
	}

	if (lastState != state) {
		icon.href = icons[state];
		lastState = state;
	}

	if (timeout) {
		timer = setTimeout(idle, timeout);
	}
}


const ws = new ReconnectingWebSocket(socketUrl);

ws.onopen = () => setActivity("idle");
ws.onclose = () => setActivity("off");

ws.onmessage = (event) => {
	setActivity("ok", 1200);

	let data = {};

	try {
		data = JSON.parse(event.data);
	} catch(error) {
		console.log("JSON parse error:", error);
		setActivity("error");
		return;
	}

	gameStats["Total"]++;
	lastEvent = Date.now();

	const message = data["message"];

	if (message) {
		const gameType = whatGame(message);
		gameStats[gameType]++;

		const tr = document.createElement("tr");
		tr.classList.add(gameType);

		// tr.title = data.header.softwareName;

		if (message.Taxi) {
			gameStats["Taxi"]++;
			tr.classList.add("taxi");
		}

		gameStats["TS"] = message.timestamp;

		try {
			const diff = new Date() - new Date(message.timestamp);
			if (diff > 3600 * 1000) { // timestamp older than 1h
				tr.classList.add("old");
				gameStats["Old"]++;
				message.isOld = true;
			}
			else if (diff < -180 * 1000) { // timestamp more than 3m ahead
				tr.classList.add("new");
				gameStats["New"]++;
			}
		} catch(error) {
			//console.log("Invalid date:", error);
		}

		if (message.event) {
			if (!(message.event in gameStats)) {
				gameStats[message.event] = 0;
			}

			gameStats[message.event]++;

			if (message.event === "Scan" && message.ScanType !== "NavBeaconDetail" && message.WasDiscovered === false) {
				tr.appendChild(makeTd(message.BodyName));
				tr.appendChild(makeTd(message.ScanType));

				addRow(newbods, tr);

				if (message.StarType) {
					const tr = document.createElement("tr");
					tr.appendChild(makeTd(message.BodyName));
					tr.appendChild(makeTd(`${message.StarType} ${message.Subclass}`));

					addRow(newstars, tr);
				}
				else if (message.PlanetClass) {
					const tr = document.createElement("tr");
					tr.appendChild(makeTd(message.BodyName));
					tr.appendChild(makeTd(message.PlanetClass));
					tr.appendChild(makeTd(`${message.AtmosphereType && message.AtmosphereType !== "None" ? message.AtmosphereType : ""}`));
					tr.appendChild(makeTd(`${message.Landable ? "Yes" : ""}`));

					addRow(newplanets, tr);
				}
			}
			else if (message.event === "Scan" && (message.ScanType === "NavBeaconDetail" || message.WasDiscovered !== false)) {
				tr.appendChild(makeTd(message.BodyName));
				tr.appendChild(makeTd(message.ScanType));

				addRow(oldbods, tr);
			}
			else if (message.event === "FSDJump") {
				tr.appendChild(makeTd(message.StarSystem));

				addRow(jumps, tr);

				if (message.Population > 0 || message.SystemAllegiance) {
					const tr = document.createElement("tr");

					tr.appendChild(makeTd(message.StarSystem));
					tr.appendChild(makeTd(`${message.Population >= 1000000000 ? (message.Population / 1000000000).toFixed(2) + "G" :
						message.Population >= 1000000 ? (message.Population / 1000000).toFixed(2) + "M" :
						message.Population >= 1000 ? (message.Population / 1000).toFixed(2) + "k" :
						message.Population > 0 ? (message.Population / 1).toFixed(2) :
						""
					}`));
					tr.appendChild(makeTd(message.SystemAllegiance));

					const faction = message.SystemFaction || {};
					tr.appendChild(makeTd(`${faction.Name || ""}`));
					tr.appendChild(makeTd(`${faction.FactionState || ""}`));

					addRow(visits, tr);
				}
			}
			else if (message.event === "FSSDiscoveryScan") {
				tr.appendChild(makeTd(message.SystemName));
				tr.appendChild(makeTd(message.BodyCount));
				tr.appendChild(makeTd(message.NonBodyCount));

				addRow(honks, tr);
			}
			else if (message.event === "Docked" || message.event === "Location") {
				tr.appendChild(makeTd(`${message.StationName || ""}`));
				tr.appendChild(makeTd(message.StarSystem));

				addRow(docks, tr);
			}
			else if (message.event === "NavRoute") {
				const route = message.Route;

				if (route.length > 1) {
					tr.appendChild(makeTd(route[0].StarSystem));
					tr.appendChild(makeTd(route[route.length-1].StarSystem));
					tr.appendChild(makeTd(`${route.length-1}j`));

					try {
						let dist = 0;
						let longest = 0;
						let cur = route.shift().StarPos;

						// distance to destination system
						tr.appendChild(makeTd(`${distance3(cur, route[route.length-1].StarPos).toFixed(2)}ly`));

						// sum jump distances
						for (const wp of route) {
							const hop = wp.StarPos;
							const range = distance3(cur, hop);

							if (maxrange < range) {
								maxrange = range;
								gameStats["Max jump range"] = `${range.toFixed(2)}ly`;
							}

							if (longest < range) {
								longest = range;
							}

							dist += range;
							cur = hop;
						}

						tr.appendChild(makeTd(`${route.length > 1 ? dist.toFixed(2) + "ly" : ""}`));

						const td = makeTd(`${longest.toFixed(2)}ly`);
						if (longest >= 200) {
							td.classList.add("longjump");
						}
						tr.appendChild(td);
					} catch(error) {
						//console.log("Error in route:", error);
					}

					addRow(routes, tr);
				}
				else {
					//console.log("Short NavRoute:", data);
				}
			}
			else if (message.event === "ApproachSettlement") {
				tr.appendChild(makeTd(message.Name));
				tr.appendChild(makeTd(message.StarSystem));

				addRow(asett, tr);
			}
/*
			else if (message.event === "CarrierJump") {
				tr.appendChild(makeTd(message.Body));
				tr.appendChild(makeTd(message.StationName));

				addRow(cjumps, tr);
			}
*/

			else if (message.event === "CodexEntry") {
				tr.appendChild(makeTd(message.System));
				tr.appendChild(makeTd(trimPrefix(message.BodyName || "", message.System)));
				tr.appendChild(makeTd(message.SubCategory));
				tr.appendChild(makeTd(message.Name));

				addRow(codex, tr);
			}

			// TODO: FSSBodySignals, FSSSignalDiscovered, SAASignalsFound

			else {
				gameStats["Ignored"]++;
			}
		}
		else {
			// commodities, modules, ships

			tr.appendChild(makeTd(message.commodities ? "Market" : message.ships ? "Shipyard" : message.modules ? "Outfitting" : ""));
			tr.appendChild(makeTd(message.stationName || ""));
			tr.appendChild(makeTd(message.systemName || ""));

			addRow(updates, tr);
		}

		const newBody = document.createElement("tbody");
		for (const gameStat in gameStats) {
			const tr = document.createElement("tr");

			tr.appendChild(makeTd(gameStat));
			tr.appendChild(makeTd(gameStats[gameStat]));

			newBody.appendChild(tr);
		}

		statstable.replaceChild(newBody, statsbody);
		statsbody = newBody;
	} else {
		//console.log("No message: ", data);
	}
}


(function watchdog() {
	if (ws.readyState === WebSocket.OPEN && Date.now() - lastEvent > 300000) {
		console.log("Receive timeout. Resetting connection.");
		ws.refresh();
	}

	const nextWake = ~~(60000 + Math.random() * 23000);
	//console.log(`Sleeping for ${nextWake}ms`);

	setTimeout(watchdog, nextWake);
})();
