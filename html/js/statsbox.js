class StatsRow {
	// TODO: shape-morphism optimization? #value is always a number except for two stats where it's a string
	#value;
	key;

	#td;
	tr;

	constructor(key, value) {
		const ktd = document.createElement("td");
		ktd.textContent = key;

		const td = document.createElement("td");
		this.#td = td;

		const tr = document.createElement("tr");
		tr.append(ktd, td);
		this.tr = tr;

		this.key = key;
		this.value = value;
	}

	set value(newValue) {
		this.#td.textContent = this.#value = newValue;
	}

	get value() {
		return this.#value;
	}
}


class StatsBox {
	#statsbody;
	_stats = {}; // indices into rows
	_rows = []; // sorted array of StatsRow

	constructor(tbody, values = {}) {
		tbody.replaceChildren(); // clear existing table content
		this.#statsbody = tbody;

		for (const key in values) {
			this.set(key, values[key]);
		}
	}

	has(key) {
		return key in this._stats;
	}

	set(key, value) {
		if (this.has(key)) {
			this._rows[this._stats[key]].value = value;
		} else {
			const stat = new StatsRow(key, value);
			this.#statsbody.append(stat.tr);
			this._stats[key] = this._rows.length;
			this._rows.push(stat);
		}
	}

	inc(key) {
		if (this.has(key)) {
			this._rows[this._stats[key]].value++;
		} else {
			this.set(key, 1);
		}
	}
}


// TODO: (re-)sort in set()

class SortedStatsBox extends StatsBox {
	inc(key) {
		if (this.has(key)) {
			const idxOld = this._stats[key];
			const stat = this._rows[idxOld];
			stat.value++;
			const val = stat.value;
			let idxNew = idxOld;
			while (idxNew > 0 && val > this._rows[idxNew-1].value) {
				idxNew--;
			}
			if (idxNew != idxOld) {
				this._rows[idxNew].tr.before(stat.tr); // move table row
				this._rows.splice(idxOld, 1); // cut
				this._rows.splice(idxNew, 0, stat); // paste
				while (idxNew <= idxOld) {
					this._stats[this._rows[idxNew].key] = idxNew++; // update indices
				}
			}
		} else {
			this.set(key, 1);
		}
	}
}


export { StatsBox, SortedStatsBox };
