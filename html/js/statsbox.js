import { makeTd } from "./utils.min.js";

class StatsBox {
	#statsbody;
	#stats = {};
	#rows = {}; // TODO: use WeakMap?

	constructor(tbody, values = {}) {
		tbody.innerHTML = ""; // TODO: workaround. remove initial table content
		this.#statsbody = tbody;

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

	// TODO: batch updates?
	#update(stat) {
		if (stat in this.#rows) {
			this.#rows[stat].textContent = this.#stats[stat];
		} else {
			const tr = document.createElement("tr");
			tr.append(makeTd(stat), this.#rows[stat] = makeTd(`${this.#stats[stat]}`));
			tr.children[0].removeAttribute("title"); tr.children[1].removeAttribute("title"); // TODO: workaround. makeTd always sets a title
			this.#statsbody.append(tr);
		}
	}
}

export { StatsBox };
