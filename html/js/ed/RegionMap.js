/**
 * @module RegionMap
 * @description Provides galactic region lookups for Elite Dangerous star
 * positions. Loads a binary run-length-encoded region map on module
 * initialisation and exposes static helpers to resolve coordinates or
 * System ID64 values to named galactic regions.
 */

import GalacticRegions from "#data/GalacticRegions.json" with { type: "json" };


// region map data URL
const MAP_URL = "./data/RegionMapData.bin";
let isReady = false; // set to true after data load

// region map scale
const MAP_SIZE = 2048; // number of z-rows
const MAP_SCALE = 83 / 4096; // ly to index

// lower-left corner coordinates of region map in ly, relative to Sol
const X0 = -49985;
const Y0 = -40985;
const Z0 = -24105;

// region lookup tables
let rowIndex; // z-axis: per-row index into rleData (MAP_SIZE+1 entries)
let rleData;  // x-axis: variable-length runs of tuples (length, regionID)


/**
 * Static utility class for resolving galactic coordinates and System ID64
 * values to Elite Dangerous galactic regions using a pre-loaded binary
 * region map.
 *
 * `await RegionMap.ready` to load the data before calling `RegionMap.findRegion()`
 */
export class RegionMap {
	static #readyPromise;

	/**
	 * Promise that resolves when the binary region-map data has finished loading.
	 *
	 * @type {Promise<void>}
	 */
	static get ready() { return this.#readyPromise ??= loadMap(MAP_URL); } // `await RegionMap.ready;`

	/**
	 * Whether the region map data has been loaded and is ready for lookups.
	 *
	 * @type {boolean}
	 */
	static get isReady() { return isReady; }

	/** @type {number} X-axis origin of the region map in light-years relative to Sol. */
	static get X0() { return X0; }
	/** @type {number} Y-axis origin of the region map in light-years relative to Sol. */
	static get Y0() { return Y0; }
	/** @type {number} Z-axis origin of the region map in light-years relative to Sol. */
	static get Z0() { return Z0; }


	/**
	 * Looks up the galactic region for the given coordinates.
	 *
	 * @param {number} x - X coordinate in light-years relative to Sol.
	 * @param {number} _y - Y coordinate (unused in the 2-D region map).
	 * @param {number} z - Z coordinate in light-years relative to Sol.
	 * @returns {{id: number, name: string|null}} Region object, or `{id: 0, name: null}` if not found.
	 */
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
		const end = rowIndex[pz + 1] - 1; // rows should have even length, ensure that [i+1] is always in range

		// array data is [Length, ID, Length, ID...]
		let remainingX = px;
		for (let i = start; i < end; i += 2) {

			// find the length/region tuple that contains px
			const runLength = rleData[i];
			if (remainingX < runLength) {
				const regionId = rleData[i + 1];
				return { id: regionId, name: GalacticRegions[regionId] };
			}
	
			// skip to next segment
			remainingX -= runLength;
		}

		// coordinates not found in rleData
		return { id: 0, name: null };
	}


	/**
	 * Finds the galactic region for a given System ID64 by first decoding it
	 * into boxel coordinates.
	 *
	 * @param {string|bigint} id64 - The 64-bit system identifier.
	 * @returns {{id: number, name: string|null}} Region object.
	 */
	// id64 should be String or BigInt
	static findRegionForId64(id64) {
		const { BoxelPos } = this.decodeId64(id64);
		return this.findRegion(...BoxelPos);
	}


	/**
	 * Converts sector and boxel coordinates to galactic coordinates in
	 * light-years relative to Sol.
	 *
	 * @param {number} xs - X sector coordinate.
	 * @param {number} ys - Y sector coordinate.
	 * @param {number} zs - Z sector coordinate.
	 * @param {number} [massClass=0] - Mass class (0–7, corresponding to A–H).
	 * @param {number} [xb=0] - X boxel coordinate.
	 * @param {number} [yb=0] - Y boxel coordinate.
	 * @param {number} [zb=0] - Z boxel coordinate.
	 * @returns {{x: number, y: number, z: number}} Galactic coordinates.
	 */
	static sectorsToCoords(xs, ys, zs, massClass = 0, xb = 0, yb = 0, zb = 0) {
		// 1280ly per sector, 10ly (A) to 1280ly (H) per boxel
		// TODO: return center coords instead of corner
		const x = ((xs << 7) + (xb << massClass)) * 10 + X0;
		const y = ((ys << 7) + (yb << massClass)) * 10 + Y0;
		const z = ((zs << 7) + (zb << massClass)) * 10 + Z0;

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

	/**
	 * Decodes a 64-bit system identifier into its component parts including
	 * sector/boxel coordinates, mass class, body ID, and galactic position.
	 *
	 * @param {string|bigint} id64 - The 64-bit system identifier.
	 * @returns {{SystemAddress: bigint, BoxelPos: number[], BodyId: number, massClass: number, xs: number, ys: number, zs: number, xb: number, yb: number, zb: number, n2: number}}
	 */
	// id64 should be String or BigInt. Number type could garble the critical lower bits
	static decodeId64(id64) {
		const _id64 = BigInt(id64);

		const SystemAddress = bitMask(_id64, 55n);
		const BodyId = Number(_id64 >> 55n);

		const massClass = Number(bitMask(_id64, 3n));
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

	/**
	 * Generates the procedural suffix of a system name from its boxel
	 * coordinates and sequence number.
	 *
	 * @param {number} massClass - Mass class (0–7).
	 * @param {number} xb - X boxel coordinate.
	 * @param {number} yb - Y boxel coordinate.
	 * @param {number} zb - Z boxel coordinate.
	 * @param {number} n2 - Within-boxel sequence number.
	 * @returns {string} The procedural system-name suffix (e.g. `"AB-C a1-23"`).
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


/**
 * Extracts a bit field from a BigInt value.
 *
 * @param {bigint} field - The source value.
 * @param {bigint} bits - Number of bits to extract.
 * @param {bigint} [shift=0n] - Bit offset to shift before masking.
 * @returns {bigint} The extracted bit field.
 */
const bitMask = (field, bits, shift = 0n) => (field >> shift) & (~(~0n << bits));


/**
 * Fetch binary region map data and set up the ArrayBuffer views
 * binary data created from RegionMapData.json: https://github.com/klightspeed/EliteDangerousRegionMap
 * Layout: [RowIndex (Uint32)...] [RLE Data (Uint16)...]
 */
async function loadMap(url) {
	try {
		console.debug("RegionMap: loading data...");

		if (isReady) {
			console.warn("RegionMap: loadMap() called when isReady is true");
			return;
		}

		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status} ${response.statusText}`);
		}

		const buffer = await response.arrayBuffer();

		const offsetCount = MAP_SIZE + 1;
		const offsetByteSize = offsetCount * 4;

		// hypothetically, someone could browse the site on an IBM Z mainframe...
		const isLittleEndian = new Uint8Array(new Uint32Array([0x12345678]).buffer)[0] === 0x78;
		if (!isLittleEndian) {
			console.debug("RegionMap: converting byte-order");
			const view = new DataView(buffer);

			// Uint32 index section
			for (let i = 0; i < offsetByteSize; i += 4) {
				view.setUint32(i, view.getUint32(i, true));
			}

			// Uint16 data section
			for (let i = offsetByteSize; i < buffer.byteLength; i += 2) {
				view.setUint16(i, view.getUint16(i, true));
			}
		}

		// map data view onto byte buffer
		rowIndex = new Uint32Array(buffer, 0, offsetCount);
		rleData = new Uint16Array(buffer, offsetByteSize);

		// last index points to end of rleData
		if (rleData.length !== rowIndex[MAP_SIZE]) {
			throw new Error(`Data length mismatch: Got ${rleData.length}, expected ${rowIndex[MAP_SIZE]}`);
		}

		isReady = true;
		console.debug(`RegionMap: load done - ${MAP_SIZE} rows, ${rleData.length / 2} segments`);
	} catch (err) {
		throw new Error("RegionMap: initialization failed", { cause: err });
	}
}


export default RegionMap;
