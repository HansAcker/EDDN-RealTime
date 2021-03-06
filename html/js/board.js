"use strict";
import { Vector3 } from "/js/three.module.min.js";
import { ReconnectingWebSocket } from "/js/reconnecting-websocket.min.js";

const socketUrl = "wss://eddn-realtime.space/.ws/eddn";
const listLength = 20;

let maxrange = 0;

const gamestats = document.getElementById("stats");
let statsbody = gamestats.querySelector("tbody");

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

const whatGame = (msg) => msg.odyssey ? "Odyssey" : msg.horizons ? "Horizons" : msg.horizons === false ? "Base" : "Unknown";
const makeTd = (textContent) => { const td = document.createElement("td"); td.textContent = textContent; return td; };

let lastEvent = Date.now();

const ws = new ReconnectingWebSocket(socketUrl);

ws.onmessage = (event) => {
	function addRow(tbody, tr) {
		while (tbody.children.length >= listLength) {
			tbody.removeChild(tbody.lastChild);
		}

		tbody.insertBefore(tr, tbody.firstChild);
	}

	let data = {};

	try {
		data = JSON.parse(event.data);
	} catch(error) {
		console.log("JSON parse error:", error);
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
					tr.appendChild(makeTd(`${faction.Name ? faction.Name : ""}`));
					tr.appendChild(makeTd(`${faction.FactionState ? faction.FactionState : ""}`));

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
				tr.appendChild(makeTd(`${message.StationName ? message.StationName : ""}`));
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
						let cur = new Vector3().fromArray(route[0].StarPos);

						// distance to destination system
						tr.appendChild(makeTd(`${cur.distanceTo(new Vector3().fromArray(route[route.length-1].StarPos)).toFixed(2)}ly`));

						route.shift();

						// sum jump distances
						for (const wp of route) {
							const hop = new Vector3().fromArray(wp.StarPos);
							const range = cur.distanceTo(hop);

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
			else if (message.event === "CarrierJump") {
				tr.appendChild(makeTd(message.Body));
				tr.appendChild(makeTd(message.StationName));

				addRow(cjumps, tr);
			}

			// TODO: FSSBodySignals, FSSSignalDiscovered, SAASignalsFound, CodexEntry

			else {
				gameStats["Ignored"]++;
			}
		}
		else {
			// commodities, modules, ships

			tr.appendChild(makeTd(message.commodities ? "Market" : message.ships ? "Shipyard" : message.modules ? "Outfitting" : ""));
			tr.appendChild(makeTd(message.stationName ? message.stationName : ""));
			tr.appendChild(makeTd(message.systemName ? message.systemName : ""));

			addRow(updates, tr);
		}

		const newBody = document.createElement("tbody");
		for (const gameStat in gameStats) {
			const tr = document.createElement("tr");

			tr.appendChild(makeTd(gameStat));
			tr.appendChild(makeTd(gameStats[gameStat]));

			newBody.appendChild(tr);
		}

		gamestats.replaceChild(newBody, statsbody);
		statsbody = newBody;
	} else {
		//console.log("No message: ", data);
	}
}

(function watchdog() {
	if (ws.readyState === 1 && Date.now() - lastEvent > 300000) {
		console.log("Receive timeout. Resetting connection.");
		ws.refresh();
	}

	const nextWake = ~~(60000 + Math.random() * 23000);
	//console.log(`Sleeping for ${nextWake}ms`);

	setTimeout(watchdog, nextWake);
})();
