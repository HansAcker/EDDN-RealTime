// export const distanceN = (v0, v1) => Math.hypot(...v0.map((v, i) => v - v1[i]));
export const distance3 = (v0, v1) => Math.hypot(v0[0] - v1[0], v0[1] - v1[1], v0[2] - v1[2]); // subtract vectors, return length
export const trimPrefix = (str, prefix) => (str.startsWith(prefix) ? str.slice(prefix.length) : str).trim();
export const makeTd = (textContent) => { const td = document.createElement("td"); td.textContent = td.title = textContent; return td; };

export function addRow(tbody, tr) {
	// TODO: remove/rework global config option listLength
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

export const GalacticRegions = [
	"Null", // 0
	"Galactic Centre", // 1
	"Empyrean Straits", // 2
	"Ryker's Hope", // 3
	"Odin's Hold", // 4
	"Norma Arm", // 5
	"Arcadian Stream", // 6
	"Izanami", // 7
	"Inner Orion-Perseus Conflux", // 8
	"Inner Scutum-Centaurus Arm", // 9
	"Norma Expanse", // 10
	"Trojan Belt", // 11
	"The Veils", // 12
	"Newton's Vault", // 13
	"The Conduit", // 14
	"Outer Orion-Perseus Conflux", // 15
	"Orion-Cygnus Arm", // 16
	"Temple", // 17
	"Inner Orion Spur", // 18
	"Hawking's Gap", // 19
	"Dryman's Point", // 20
	"Sagittarius-Carina Arm", // 21
	"Mare Somnia", // 22
	"Acheron", // 23
	"Formorian Frontier", // 24
	"Hieronymus Delta", // 25
	"Outer Scutum-Centaurus Arm", // 26
	"Outer Arm", // 27
	"Aquila's Halo", // 28
	"Errant Marches", // 29
	"Perseus Arm", // 30
	"Formidine Rift", // 31
	"Vulcan Gate", // 32
	"Elysian Shore", // 33
	"Sanguineous Rim", // 34
	"Outer Orion Spur", // 35
	"Achilles's Altar", // 36
	"Xibalba", // 37
	"Lyra's Song", // 38
	"Tenebrae", // 39
	"The Abyss", // 40
	"Kepler's Crest", // 41
	"The Void", // 42
];
