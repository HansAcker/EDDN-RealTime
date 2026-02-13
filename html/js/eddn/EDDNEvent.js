/**
 * @module EDDNEvent
 * @description Standardized event wrapper for EDDN messages. Extends the native
 * {@link Event} class with lazily computed properties for schema type, game metadata,
 * star system coordinates, and galactic region lookup via {@link RegionMap}.
 */

import { RegionMap } from "#ed/RegionMap.js";

/**
 * A standardized event wrapper for all EDDN messages. Extends the native
 * {@link Event} class with lazily computed properties for schema type, game
 * metadata, star system coordinates, and galactic region lookup.
 *
 * @extends Event
 */
export class EDDNEvent extends Event {
	$schemaRef;
	header;
	message;
	data; // event data { $schemaRef, header, message } for easier reference

	#receiveTimestamp; // timestamp of event creation (local clock)

	#age = 0; // difference between gatewayTimestamp (gateway clock) and timestamp (sender clock), set by get age()
	#gotAge = false;

	#eventType; // derived from schema/message.event. set by get eventType()
	#eventName; // message.event if present, otherwise eventType, set by get eventName()
	#gameType; // Odyssey, Horizons. set by get gameType()

	#isTaxi;
	#isMulticrew;

	#starSystem; // derived from message.StarSystem, .systemName, .SytemName, .System or first hop of .Route, defaults to "", set by get StarSystem()

	#starPos; // derived from message.StarPos or first .Route hop, defaults to undefined, set by get StarPos()
	#gotStarPos = false;

	#region; // RegionMap.findRegion(...#starPos), empty {} if StarPos is undefined, set by get Region()


	/**
	 * @param {string} type - The event type ("eddn:message")
	 * @param {object} data - The structured payload
	 * @param {string} data.$schemaRef - The original schema URL
	 * @param {Record<string, any>} data.header - The EDDN header (uploaderID, softwareName, etc.)
	 * @param {Record<string, any>} data.message - The actual game data
	 */
	constructor(type, data) {
		super(type);

		({ $schemaRef: this.$schemaRef, header: this.header, message: this.message } = this.data = data);

		// store a number here, make it a Date object on request
		this.#receiveTimestamp = Date.now();
	}


	/**
	 * Returns the timestamp at which this event was received (local clock).
	 *
	 * @returns {Date}
	 */
	// TODO: make it return the number instead of Date? nothing uses this, yet
	get receiveTimestamp() {
		return new Date(this.#receiveTimestamp);
	}

	/**
	 * Returns the age of the message in milliseconds (gateway timestamp minus
	 * sender timestamp). Positive values indicate the message was sent in the
	 * past; negative values indicate clock skew or future timestamps.
	 *
	 * @returns {number}
	 */
	// TODO: rename? age should be "receiveTimestamp - gatewayTimestamp"
	get age() {
		return this.#gotAge ? this.#age :
			(this.#gotAge = true, this.#age = (Date.parse(this.header?.gatewayTimestamp) - Date.parse(this.message?.timestamp)));
	}

	/**
	 * Returns the normalised event type derived from the EDDN schema URL and,
	 * for journal schemas, the `message.event` field (e.g. `"journal:fsdjump"`).
	 *
	 * @returns {string}
	 */
	get eventType() {
		return this.#eventType ??= EDDNEvent.getEventType(this.data);
	}

	/**
	 * Returns the game event name from `message.event`, falling back to
	 * {@link EDDNEvent#eventType} if the property is absent.
	 *
	 * @returns {string}
	 */
	get eventName() {
		return this.#eventName ??= (this.message?.event ?? this.eventType);
	}

	/**
	 * Returns the game type string (e.g. `"Odyssey"`, `"Horizons"`, `"Base"`,
	 * `"Legacy"`, or `"Unknown"`).
	 *
	 * @returns {string}
	 */
	get gameType() {
		return this.#gameType ??= EDDNEvent.getGameType(this.data);
	}

	/**
	 * Whether the commander is currently in a taxi (Apex Interstellar shuttle).
	 *
	 * @returns {boolean}
	 */
	get isTaxi() {
		return this.#isTaxi ??= !!this.message?.Taxi;
	}

	/**
	 * Whether the commander is in a multicrew session.
	 *
	 * @returns {boolean}
	 */
	get isMulticrew() {
		return this.#isMulticrew ??= !!this.message?.Multicrew;
	}

	/**
	 * Returns the star system name derived from various message properties,
	 * or an empty string if none is available.
	 *
	 * @returns {string}
	 */
	get StarSystem() {
		return this.#starSystem ??= (this.message?.StarSystem ?? this.message?.systemName ??
			this.message?.SystemName ?? this.message?.System ?? this.message?.Route?.[0]?.StarSystem ?? "");
	}

	/**
	 * Returns the star position as a `[x, y, z]` coordinate array in
	 * light-years relative to Sol, or `undefined` if unavailable.
	 *
	 * @returns {number[]|undefined}
	 */
	get StarPos() {
		return this.#gotStarPos ? this.#starPos :
			(this.#gotStarPos = true, this.#starPos = this.message?.StarPos ?? this.message?.Route?.[0]?.StarPos);
	}

	/**
	 * Returns the galactic region for this event's star position.
	 *
	 * @returns {{id: number, name: string|null}} Region object with `id` and `name`, or an empty object if the position is unknown.
	 */
	get Region() {
		return this.#region ??= (this.StarPos ? RegionMap.findRegion(...this.StarPos) : {});
	}


	/**
	 * Normalizes the schema URL into a clean event string.
	 * content: https://eddn.edcd.io/schemas/navroute/1 -> "navroute"
	 * content: https://eddn.edcd.io/schemas/commodity/3 -> "commodity"
	 *
	 * Adds event sub-type to journal events, e.g. "journal:fsdjump"
	 *
	 * TODO: return "outfitting/2/test" etc. with -test suffix?
	 *
	 * @param {object} data - The structured payload `{ $schemaRef, header, message }`
	 * @param {string} data.$schemaRef - The schema reference URL.
	 * @param {Record<string, any>} data.header - The EDDN header.
	 * @param {Record<string, any>} data.message - The actual game data.
	 * @returns {string} The normalized event type
	 */
	static getEventType(data) {
		if (!data?.$schemaRef) {
			return "";
		}

		let eventType = data.$schemaRef.match(RX_SCHEMAREF)?.[1] ?? "";

		// If it's a journal schema, append the specific game event
		// Journal events (FSDJump, Docked) are defined inside the 'message.event' property
		if (eventType === "journal" && data.message?.event) {
			eventType = `journal:${data.message.event.toLowerCase()}`;
		}

		// Otherwise, just return the schema name (e.g., "commodity", "shipyard", "outfitting")
		return eventType;
	}

	/**
	 * Determines the game type from header and message flags.
	 *
	 * @param {object} data - The structured EDDN payload.
	 * @param {string} data.$schemaRef - The schema reference URL.
	 * @param {Record<string, any>} data.header - The EDDN header.
	 * @param {Record<string, any>} data.message - The actual game data.
	 * @returns {string} One of `"Odyssey"`, `"Horizons"`, `"Base"`, `"Legacy"`, or `"Unknown"`.
	 */
	static getGameType(data) {
		try {
			// no decision if gameversion is not set or set to CAPI-<endpoint>
			// https://github.com/EDCD/EDDN/blob/live/docs/Developers.md#gameversions-and-gamebuild
			const gameversion = data.header.gameversion;
			if (gameversion && (gameversion.startsWith("CAPI-Legacy-") || parseInt(gameversion) < 4)) {
				return "Legacy";
			}

			// https://github.com/EDCD/EDDN/blob/live/docs/Developers.md#horizons-and-odyssey-flags
			const msg = data.message;
			return msg.odyssey ? "Odyssey" :
					msg.horizons ? "Horizons" :
					msg.horizons === false ? "Base" :
					"Unknown";
		} catch (err) {
			console.error("gameversion error:", err);
			return "Unknown";
		}
	}
}


// extract schema name into $1
const RX_SCHEMAREF = /\/schemas\/([^/]+)\/(\d+)(\/test)?$/;
