
export class MessageRouter {
	#topics = new Map();
	#wildcards = new Set();

	constructor(source) {
		source.addEventListener("eddn:message", (event) => this.#dispatch(event));
	}

	register(callback, topics) {
		if (!topics) {
			this.#wildcards.add(callback);
			return;
		}

		if (!Array.isArray(topics)) {
			console.warn("topics must be an array");
			return;
		}

		for (const topic of topics) {
			if (topic === "*") {
				this.#wildcards.add(callback);
				continue;
			}

			if (!this.#topics.has(topic)) {
				this.#topics.set(topic, new Set());
			}

			this.#topics.get(topic).add(callback);
		}
	}

	unregister(callback, topics) {
		if (!topics) {
			this.#wildcards.delete(callback);
			return;
		}

		if (!Array.isArray(topics)) {
			console.warn("topics must be an array");
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

	#dispatch(event) {
		for (const callback of this.#wildcards) {
			callback(event);
		}		

		const tgroup = this.#topics.get(event.eventType);
		if (tgroup) {
			for (const callback of tgroup) {
				callback(event);
			}
		}
	}
}
