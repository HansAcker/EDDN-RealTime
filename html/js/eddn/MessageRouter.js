
export class MessageRouter {
	#topics = new Map();
	#wildcards = new Set();

	constructor(source, options = {}) {
		// optional external abort signal
		const { signal } = options;

		// subscribe to all messages
		source.addEventListener("eddn:message", (event) => this.#dispatch(event), { signal });
	}

	register(callback, topics) {
		if (!topics) {
			this.#wildcards.add(callback);
			return;
		}

		// support passing a single string
		if (typeof topics === "string") {
			topics = [topics];
		}

		if (typeof topics[Symbol.iterator] !== "function") {
			console.warn("topics must be iterable");
			return;
		}

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

	unregister(callback, topics) {
		if (!topics) {
			this.#wildcards.delete(callback);
			return;
		}

		// support passing a single string
		if (typeof topics === "string") {
			topics = [topics];
		}

		if (typeof topics[Symbol.iterator] !== "function") {
			console.warn("topics must be iterable");
			return;
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

	unregisterAll(callback) {
		this.#wildcards.delete(callback);

		for (const [topic, tgroup] of this.#topics) {
			tgroup.delete(callback);
			if (tgroup.size === 0) {
				this.#topics.delete(topic);
			}
		}
	}

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


function invoke(cb, event) {
	try {
		cb(event);
	} catch (err) {
		console.error("Error in message handler:", err);
	}
}
