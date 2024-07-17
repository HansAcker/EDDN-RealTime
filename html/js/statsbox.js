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
			this.#rows[stat].textContent = this.#stats[stat];
		} else {
			const row = document.createElement("tr");
			row.append(StatsBox.#makeTd(stat), this.#rows[stat] = StatsBox.#makeTd(this.#stats[stat]));
			this.#statsbody.append(row);
		}
	}

	// TODO: move to inevitable utility module
	static #makeTd = (textContent) => { const td = document.createElement("td"); td.textContent = textContent; return td; };
}

export { StatsBox };
