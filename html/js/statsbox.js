import { makeTd } from "./utils.min.js";

class StatsBox {
	#statsbody;
	#stats;
	#rows;

	constructor(tbody, values = {}) {
		tbody.innerHTML = ""; // TODO: workaround. remove initial table content
		this.#statsbody = tbody;
		this.#stats = {};
		this.#rows = {}; // TODO: use WeakMap?

		for (const key in values) {
			this.set(key, values[key]);
		}
	}

	has(key) {
		return key in this.#stats;
	}

	set(key, value) {
		this.#stats[key] = value;
		this.#update(key);
	}

	inc(key) {
		if (!this.has(key)) {
			this.set(key, 0);
		}

		this.#stats[key]++;
		this.#update(key);
	}

	#update(stat) {
		if (stat in this.#rows) {
			// TODO: this leaves the initial title attribute unchanged
			this.#rows[stat].textContent = this.#stats[stat];
		} else {
			const row = document.createElement("tr");
			row.append(makeTd(stat), this.#rows[stat] = makeTd(`${this.#stats[stat]}`));
			this.#statsbody.append(row);
		}
	}
}

export { StatsBox };
