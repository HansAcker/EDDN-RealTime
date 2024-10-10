import { makeTd } from "./utils.min.js";

class StatsBox {
	#statsbody;
	#stats = {};
	#rows = {}; // TODO: use WeakMap?

	constructor(tbody, values = {}) {
		tbody.replaceChildren(); // TODO: workaround. remove initial table content
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



// TODO: WIP


class StatsRow {
	#value;
	key;

	#td;
	tr;

	constructor(key, value) {
		this.key = key;

		this.#td = document.createElement("td");
		const tr = document.createElement("tr");
		tr.append(makeTd(key), this.#td);
		tr.children[0].removeAttribute("title"); // TODO: workaround. makeTd always sets a title
		this.tr = tr;

		this.value = value;
	}

	set value(newValue) {
		this.#td.textContent = this.#value = newValue;
	}

	get value() {
		return this.#value;
	}
}

class SortedStatsBox {
	#statsbody;
	#stats = {}; // indices into #rows
	#rows = []; // sorted array of StatsRow

	constructor(tbody, values = {}) {
		tbody.replaceChildren(); // TODO: workaround. remove initial table content
		this.#statsbody = tbody;

		for (const key in values) {
			this.set(key, values[key]);
		}
	}

	has(key) {
		return key in this.#stats;
	}

	// TODO: (re-)sort
	set(key, value) {
		if (this.has(key)) {
			this.#rows[this.#stats[key]].value = value;
		} else {
			const stat = new StatsRow(key, value);
			this.#statsbody.append(stat.tr);
			this.#stats[key] = this.#rows.length;
			this.#rows.push(stat);
		}
	}

	inc(key) {
		if (this.has(key)) {
			const idxOld = this.#stats[key];
			const stat = this.#rows[idxOld];
			stat.value++;
			const val = stat.value;
			let idxNew = idxOld;
			while (idxNew > 0 && val > this.#rows[idxNew-1].value) {
				idxNew--;
			}
			if (idxNew != idxOld) {
				this.#rows[idxNew].tr.before(stat.tr); // move table row
				this.#rows.splice(idxOld, 1); // cut
				this.#rows.splice(idxNew, 0, stat); // paste
				while (idxNew <= idxOld) {
					this.#stats[this.#rows[idxNew].key] = idxNew++; // update indices
				}
			}
		} else {
			this.set(key, 1);
		}
	}
}


export { StatsBox, SortedStatsBox };
