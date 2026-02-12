/**
 * @module MessageRouter
 * @description Routes messages from an event source to registered callbacks based
 * on specific topics. Supports topic subscriptions and wildcard listeners for
 * {@link EDDNEvent} dispatching.
 */

/**
 * Routes messages from an event source to registered callbacks based on specific topics.
 */
export class MessageRouter {
	#topics = new Map();
	#wildcards = new Set();


	/**
	 * Creates a new MessageRouter instance.
	 * @param {EventTarget} source - The source object dispatching "eddn:message" events.
	 * @param {{ signal?: AbortSignal }} [options={}] - Optional configuration.
	 * @param {AbortSignal} [options.signal] - An AbortSignal to remove the event listener from the source.
	 */
	constructor(source, options = {}) {
		// optional external abort signal, drop all callbacks, prevent new registration
		const { signal } = options;
		signal?.addEventListener("abort", () => { this.#topics = this.#wildcards = null; }, { once: true });

		source.addEventListener("eddn:message", (event) => this.#dispatch(event), { signal });
	}


	/**
	 * Registers a callback function for one or more topics.
	 * If no topics are provided, or if the topic is "*", the callback acts as a wildcard listener.
	 * @param {(event: any) => void} callback - The function to invoke when a matching message is received.
	 * @param {string|Iterable<string>} [topics] - A single topic string, an iterable of strings, or undefined for wildcard.
	 * @param {{ signal?: AbortSignal }} [options={}] - Optional configuration.
	 * @param {AbortSignal} [options.signal] - An AbortSignal that, when aborted, unregisters the callback from the specified topics.
	 */
	register(callback, topics, options = {}) {
		const { signal } = options;

		if (!topics) {
			if (!this.#wildcards.has(callback)) {
				this.#wildcards.add(callback);
				signal?.addEventListener("abort", () => this.unregister(callback, ["*"]), { once: true });
			}
			return;
		}

		// support passing a single string
		if (typeof topics === "string") {
			topics = [topics];
		}

		else if (typeof topics[Symbol.iterator] !== "function") {
			throw new TypeError("topics must be iterable");
		}

		// make a persistent copy of the potentially consumable iterator, for the unregister handler
		topics = Array.from(topics);

		// TODO: could possibly queue up multiple listeners for the same callback
		//       - we'd have to check each set, add listener if any `.has()` returned false
		signal?.addEventListener("abort", () => this.unregister(callback, topics), { once: true });

		for (const topic of topics) {
			if (topic === "*") {
				this.#wildcards.add(callback);
				continue;
			}

			let tgroup = this.#topics.get(topic);

			if (!tgroup) {
				tgroup = new Set();
				this.#topics.set(topic, tgroup);
			}

			tgroup.add(callback);
		}
	}


	/**
	 * Unregisters a callback from specific topics.
	 * @param {(event: any) => void} callback - The callback function to remove.
	 * @param {string|Iterable<string>} [topics] - The specific topic(s) to unregister from. If omitted, unregisters from all list.
	 */
	unregister(callback, topics) {
		if (!topics) {
			this.unregisterAll(callback);
			return;
		}

		// support passing a single string
		if (typeof topics === "string") {
			topics = [topics];
		}

		else if (typeof topics[Symbol.iterator] !== "function") {
			throw new TypeError("topics must be iterable");
		}

		for (const topic of topics) {
			if (topic === "*") {
				this.#wildcards.delete(callback);
				continue;
			}

			const tgroup = this.#topics.get(topic);

			if (tgroup) {
				tgroup.delete(callback);

				if (tgroup.size === 0) {
					this.#topics.delete(topic);
				}
			}
		}
	}


	/**
	 * Removes the specified callback from all topics and wildcard lists.
	 * @param {(event: any) => void} callback - The callback function to remove completely.
	 */
	unregisterAll(callback) {
		this.#wildcards.delete(callback);

		for (const [topic, tgroup] of this.#topics) {
			tgroup.delete(callback);

			if (tgroup.size === 0) {
				this.#topics.delete(topic);
			}
		}
	}


	/**
	 * Internal dispatcher that invokes callbacks matching the event's topic.
	 * @param {{ eventType: string }} event - The message event containing an `eventType` property.
	 */
	#dispatch(event) {
		if (this.#wildcards.size > 0) {
			for (const callback of this.#wildcards) {
				invoke(callback, event);
			}
		}

		const tgroup = this.#topics.get(event.eventType);
		if (tgroup) {
			for (const callback of tgroup) {
				invoke(callback, event);
			}
		}
	}
}


/**
 * Helper to safely invoke a callback without crashing the router on errors.
 * @param {(event: any) => void} cb - The callback to execute.
 * @param {Record<string, any>} event - The event data to pass to the callback.
 */
function invoke(cb, event) {
	try {
		cb(event);
	} catch (err) {
		console.error("MessageRouter: Error in message handler:", err);
	}
}
