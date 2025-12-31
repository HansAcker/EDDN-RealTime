/**
 * A standardized event wrapper for all EDDN messages.
 * This carries the raw payload, the header, and normalized metadata.
 */
export class EDDNEvent extends Event {
	#eventType;
	#gameType;

	#timestamp;
	#timediff;

	#isOld;
	#isNew;

	#isTaxi;
	#isMulticrew;

	/**
	 * @param {string} type - The specific event type (e.g., "journal:FSDJump", "commodity")
	 * @param {Object} data - The destructured payload
	 * @param {string} data.$schemaRef - The original schema URL
	 * @param {Object} data.header - The EDDN header (uploaderID, softwareName, etc.)
	 * @param {Object} data.message - The actual game data
	 */
	constructor(type, data) {
		super(type, { cancelable: true, bubbles: false });

		this.$schemaRef = data?.$schemaRef;
		this.header = data?.header;
		this.message = data?.message;
		this.data = data;

		this.#eventType = EDDNEvent.getEventType(data);
		this.#gameType = EDDNEvent.whatGame(data);

		this.#timestamp = new Date(data?.message?.timestamp ?? Date.now());
		this.#timediff = new Date(data?.header?.gatewayTimestamp ?? Date.now()) - this.#timestamp;

		this.#isOld = this.#timediff > 3600 * 1000;
		this.#isNew = this.#timediff < 180 * -1000;

		this.#isTaxi = !!data?.message?.Taxi;
		this.#isMulticrew = !!data?.message?.Multicrew;
	}

	get eventType() {
		return this.#eventType;
	}

	get gameType() {
		return this.#gameType;
	}

	get isTaxi() {
		return this.#isTaxi;
	}

	get isMulticrew() {
		return this.#isMulticrew;
	}

	get isOld() {
		return this.#isOld;
	}

	get isNew() {
		return this.#isNew;
	}

	/**
	 * Normalizes the schema URL into a clean event string.
	 * content: https://eddn.edcd.io/schemas/navroute/1 -> "navroute"
	 * content: https://eddn.edcd.io/schemas/commodity/3 -> "commodity"
	 *
	 * TODO: return "outfitting/2/test" etc. with -test suffix?
	 */
	static getEventType(data) {
		let eventType = data.$schemaRef?.match(/\/schemas\/([^/]+)\/(\d+)(\/test)?$/)?.[1] ?? "";

		// If it's a journal schema, append the specific game event
		// Journal events (FSDJump, Docked) are defined inside the 'message.event' property
		if (eventType === "journal" && data.message?.event) {
			eventType = `journal:${data.message.event}`;
		}

		// Otherwise, just return the schema name (e.g., "commodity", "shipyard", "outfitting")
		return eventType.toLowerCase();
	}

	static whatGame(data) {
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
			console.error("gameversion error:", error);
			return "Unknown";
		}
	}
}
