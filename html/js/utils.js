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


/*
ID64
http://disc.thargoid.space/ID64

This is an ID format used by the game to identify systems and stellar bodies.
The ID is represented as a 64-bit integer.

The ID is effectively a structure, with different parts of the bitfield
representing different aspects of the system's features.

These parts are:

    Mass code (3 bits) - the mass code of the system, with a = 0 through to h = 7
    Z boxel (0-7 bits) - the Z boxel (within-sector) coordinate of the system
    Z sector (7 bits) - the Z sector coordinate of the system
    Y boxel (0-7 bits) - the Y boxel (within-sector) coordinate of the system
    Y sector (6 bits) - the Y sector coordinate of the system
    X boxel (0-7 bits) - the X boxel (within-sector) coordinate of the system
    X sector (7 bits) - the X sector coordinate of the system
    N2 (11-32 bits) - the N2 number (within-boxel identifier) of the system
    Body ID (9 bits) - the ID of the body within the system; for systems this is always 0 (representing the arrival star)

Note that the X/Y/Z boxel coordinates and the N2 number have variable sizes;
this is because the amount of space taken by these pieces of data is different
depending on the mass code.
*/

// const bitMask = (field, bits, shift) => ((BigInt(field) & (~(BigInt(~0) << BigInt(bits)) << BigInt(shift))) >> BigInt(shift))
const bitMask = (field, bits) => (BigInt(field) & (~(BigInt(~0) << BigInt(bits))));

// id64 should be String or BigInt. Number type could garble the critical lower bits
export function decodeId64(id64) {
	const _id64 = BigInt(id64);

	const bodyId = Number(_id64 >> 55);
	const systemAddress = bitMask(_id64, 55);

	const massClass = Number(bitMask(_id64, 3));
	_id64 = _id64 >> 3;

	const boxelBits = 7 - massClass;
	const boxels = boxelBits ? 2**boxelBits : 0;

	const zb = Number(bitMask(_id64, boxelBits));
	_id64 = _id64 >> boxelBits;

	const zs = Number(bitMask(_id64, 7));
	_id64 = _id64 >> 7;

	const yb = Number(bitMask(_id64, boxelBits));
	_id64 = _id64 >> boxelBits;

	const ys = Number(bitMask(_id64, 6));
	_id64 = _id64 >> 6;

	const xb = Number(bitMask(_id64, boxelBits));
	_id64 = _id64 >> boxelBits;

	const xs = Number(bitMask(_id64, 7));
	_id64 = _id64 >> 7;

	const n2 = Number(bitMask(_id64, 32-(boxelBits*3)));

	return { systemAddress, bodyId, massClass, boxels, xs, xb, ys, yb, zs, zb, n2 };
}

/*
https://www.reddit.com/r/EliteDangerous/comments/hvuwb6/galmap_starnaming_from_id64/
https://docs.google.com/spreadsheets/d/1hJVYIKc2EKjA119qQNCyMOR0PC5xreSjB85zNnkzKTA
*/

export function procSystemName(massClass, xb, yb, zb, n2) {
	let id = xb | (yb << 7) | (zb << 14);

	const c1 = String.fromCharCode((id % 26) + 65);
	id = ~~(id / 26);

	const c2 = String.fromCharCode((id % 26) + 65);
	id = ~~(id / 26);

	const c3 = String.fromCharCode((id % 26) + 65);
	id = ~~(id / 26);

	return `${c1}${c2}-${c3} ${String.fromCharCode(massClass + 97)}${id ? `${id}-${n2}` : n2}`;
}
