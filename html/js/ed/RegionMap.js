import GalacticRegions from "#ed/GalacticRegions.json" with { type: "json" };


// Sol-centered coordinate system
const X0 = -49985;
const Y0 = -40985;
const Z0 = -24105;

// region map scale
const MAP_SIZE = 2048;
const MAP_SCALE = 83 / 4096; // ly to index

// region lookup tables
let rowIndex; // z-axis: per-row index into rleData (MAP_SIZE+1 entries)
let rleData;  // x-axis: variable-length runs of tuples (length, regionID)

let isReady = false; // set to true after data load


// fetch arraybuffer data on module init
// binary data created from RegionMapData.json: https://github.com/klightspeed/EliteDangerousRegionMap
// Layout: [RowIndex (Uint32)...] [RLE Data (Uint16)...]
const readyPromise = (async function loadData() {
	try {
		// hypothetically, someone could browse the site on an IBM Z mainframe...
		const isLittleEndian = new Uint8Array(new Uint32Array([0x12345678]).buffer)[0] === 0x78;
		const MAP_URL = `/js/ed/RegionMapData${isLittleEndian ? "" : "_BE"}.bin`;

		console.debug("RegionMap: loading data...");
		const response = await fetch(MAP_URL);
		if (!response.ok) {
			throw new Error(`Failed to load map data: ${response.statusText}`);
		}

		const buffer = await response.arrayBuffer();

		const offsetCount = MAP_SIZE + 1;
		const offsetByteSize = offsetCount * 4;

		// map data view onto byte buffer
		rowIndex = new Uint32Array(buffer, 0, offsetCount);
		rleData = new Uint16Array(buffer, offsetByteSize);

		if (rleData.length !== rowIndex[MAP_SIZE]) {
			throw new Error(`Data length mismatch: Got ${rleData.length}, expected ${rowIndex[MAP_SIZE]}`);
		}

		isReady = true;
		console.debug("RegionMap: data loaded");
	} catch (err) {
		console.error("RegionMap: initialization failed:", err);
		// initialize empty buffers
		rowIndex = new Uint32Array(MAP_SIZE + 1);
		rleData = new Uint16Array(0);
	}
})();


const bitMask = (field, bits, shift) => (field >> shift) & (~(~0n << bits));


export class RegionMap {
	static get ready() { return readyPromise; } // `await RegionMap.ready;`
	static get isReady() { return isReady; }

	static get X0() { return X0; }
	static get Y0() { return Y0; }
	static get Z0() { return Z0; }


	// find region for galactic coordinates
	static findRegion(x, _y, z) {
		if (!isReady || x === undefined || z === undefined) {
			return { id: 0, name: null };
		}

		// z |_
		//    x

		// map x/z coordinates to lookup index
		const px = Math.floor((x - X0) * MAP_SCALE);
		const pz = Math.floor((z - Z0) * MAP_SCALE);

		if (px < 0 || px >= MAP_SIZE || pz < 0 || pz >= MAP_SIZE) {
			return { id: 0, name: null };
		}

		// fetch rleData index for this and the next z-row
		const start = rowIndex[pz];
		const end = rowIndex[pz + 1];

		// array data is [Length, ID, Length, ID...]
		let remainingX = px;
		for (let i = start; i < end-1; i += 2) {

			// find the length/region tuple that contains px
			const runLength = rleData[i];
			if (remainingX < runLength) {
				const regionId = rleData[i + 1];
				return regionId === 0 
					? { id: 0, name: null } 
					: { id: regionId, name: GalacticRegions[regionId] };
			}
	
			// skip to next segment
			remainingX -= runLength;
		}

		// coordinates not found in rleData
		return { id: 0, name: null };
	}


	// id64 should be String or BigInt
	static findRegionForId64(id64) {
		const { BoxelPos } = this.decodeId64(id64);
		return this.findRegion(...BoxelPos);
	}


	static sectorsToCoords(xs, ys, zs, massClass = 0, xb = 0, yb = 0, zb = 0) {
		// 1280ly per sector, 10ly (A) to 1280ly (H) per boxel
		const x = ((xs << 7) | (xb << massClass)) * 10 + X0
		const y = ((ys << 7) | (yb << massClass)) * 10 + Y0
		const z = ((zs << 7) | (zb << massClass)) * 10 + Z0

		return { x, y, z };
	}


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

	// id64 should be String or BigInt. Number type could garble the critical lower bits
	static decodeId64(id64) {
		let _id64 = BigInt(id64);

		const SystemAddress = bitMask(_id64, 55n, 0n);
		const BodyId = Number(_id64 >> 55n);

		const massClass = Number(bitMask(_id64, 3n, 0n));
		const boxelBits = BigInt(7 - massClass);
		let shift = 3n;

		const zb = Number(bitMask(_id64, boxelBits, shift));
		shift += boxelBits;

		const zs = Number(bitMask(_id64, 7n, shift));
		shift += 7n;

		const yb = Number(bitMask(_id64, boxelBits, shift));
		shift += boxelBits;

		const ys = Number(bitMask(_id64, 6n, shift));
		shift += 6n;

		const xb = Number(bitMask(_id64, boxelBits, shift));
		shift += boxelBits;

		const xs = Number(bitMask(_id64, 7n, shift));
		shift += 7n;

		const n2 = Number(bitMask(_id64, 32n-(boxelBits*3n), shift));

		const { x, y, z } = this.sectorsToCoords(xs, ys, zs, massClass, xb, yb, zb);

		// TODO: decide on a return format
		return { SystemAddress, BoxelPos: [x, y, z], BodyId, massClass, xs, ys, zs, xb, yb, zb, n2 };
		//return { SystemAddress, BodyId, BoxelPos: [x, y, z], Sector: [xs, ys, zs], Boxel: [xb, yb, zb], massClass, n2 };
	}


	/*
	https://www.reddit.com/r/EliteDangerous/comments/hvuwb6/galmap_starnaming_from_id64/
	https://docs.google.com/spreadsheets/d/1hJVYIKc2EKjA119qQNCyMOR0PC5xreSjB85zNnkzKTA
	*/

	static procSystemName(massClass, xb, yb, zb, n2) {
		let id = xb | (yb << 7) | (zb << 14);

		const c1 = String.fromCharCode((id % 26) + 65);
		id = ~~(id / 26);

		const c2 = String.fromCharCode((id % 26) + 65);
		id = ~~(id / 26);

		const c3 = String.fromCharCode((id % 26) + 65);
		id = ~~(id / 26);

		return `${c1}${c2}-${c3} ${String.fromCharCode(massClass + 97)}${id ? `${id}-${n2}` : n2}`;
	}
}
