/**
 * A standardized event wrapper for all EDDN messages.
 */
export class EDDNEvent extends Event {
	$schemaRef;
	header;
	message;
	data; // event data { $schemaRef, header, message } for easier reference

	receiveTimestamp; // timestamp of event creation (local clock)
	#age; // difference between gatewayTimestamp (gateway clock) and timestamp (game clock), set by get age()

	#eventType; // derived from schema/message.event. set by get eventType()
	#eventName; // message.event if present, set by get eventName()
	#gameType; // Odyssey, Horizons. set by get gameType()

	#isTaxi;
	#isMulticrew;


	/**
	 * @param {string} type - The event type ("eddn:message")
	 * @param {Object} data - The structured payload
	 * @param {string} data.$schemaRef - The original schema URL
	 * @param {Object} data.header - The EDDN header (uploaderID, softwareName, etc.)
	 * @param {Object} data.message - The actual game data
	 */
	constructor(type, data) {
		super(type);

		const { $schemaRef, header, message } = data;

		this.$schemaRef = $schemaRef;
		this.header = header;
		this.message = message;
		this.data = data;

		this.receiveTimestamp = new Date();
	}


	get age() {
		return this.#age ?? (this.#age = (new Date(this.header?.gatewayTimestamp) - new Date(this.message?.timestamp)));
	}

	get eventType() {
		return this.#eventType ?? (this.#eventType = EDDNEvent.getEventType(this.data));
	}

	get gameType() {
		return this.#gameType ?? (this.#gameType = EDDNEvent.getGameType(this.data));
	}

	get eventName() {
		return this.#eventName ?? (this.#eventName = this.message?.event ?? this.eventType);
	}

	get isTaxi() {
		return this.#isTaxi ?? (this.#isTaxi = !!this.message?.Taxi);
	}

	get isMulticrew() {
		return this.#isMulticrew ?? (this.#isMulticrew = !!this.message?.Multicrew);
	}


	/**
	 * Normalizes the schema URL into a clean event string.
	 * content: https://eddn.edcd.io/schemas/navroute/1 -> "navroute"
	 * content: https://eddn.edcd.io/schemas/commodity/3 -> "commodity"
	 *
	 * TODO: return "outfitting/2/test" etc. with -test suffix?
	 */
	static getEventType(data) {
		let eventType = data?.$schemaRef?.match(/\/schemas\/([^/]+)\/(\d+)(\/test)?$/)?.[1] ?? "";

		// If it's a journal schema, append the specific game event
		// Journal events (FSDJump, Docked) are defined inside the 'message.event' property
		if (eventType === "journal" && data?.message?.event) {
			eventType = `journal:${data.message.event}`;
		}

		// Otherwise, just return the schema name (e.g., "commodity", "shipyard", "outfitting")
		return eventType.toLowerCase();
	}

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
			return msg.odyssey ? "Odyssey" : msg.horizons ? "Horizons" : msg.horizons === false ? "Base" : "Unknown";
		} catch (error) {
			console.error("gameversion error:", error);
			return "Unknown";
		}
	}
}
