// const distanceN = (v0, v1) => Math.hypot.apply(null, v0.map((v, i) => v - v1[i]));
export const distance3 = (v0, v1) => Math.hypot(v0[0] - v1[0], v0[1] - v1[1], v0[2] - v1[2]); // subtract vectors, return length
export const trimPrefix = (str, prefix) => (str.startsWith(prefix) ? str.slice(prefix.length) : str).trim();
export const makeTd = (textContent) => { const td = document.createElement("td"); td.textContent = td.title = textContent; return td; };

export function addRow(tbody, tr) {
	while (tbody.childElementCount >= listLength) {
		tbody.lastElementChild.remove();
	}

	tbody.prepend(tr);
}

export function whatGame(data) {
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
