
// counts and displays named events or other information

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
	_rows = []; // array of StatsRow

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


// SortedStatsBox keeps _rows and table sorted on inc()
// TODO: (re-)sort in set()

class SortedStatsBox extends StatsBox {
	inc(key) {
		if (this.has(key)) {
			let idxOld = this._stats[key];
			const stat = this._rows[idxOld];

			stat.value++;
			const val = stat.value;

			// find new position in rows array
			let idxNew = idxOld;
			while (idxNew > 0 && val > this._rows[idxNew-1].value) {
				//console.log(`${key}: ${this._rows[idxNew-1].key} ${this._stats[this._rows[idxNew-1].key]} => ${idxNew}`);
				this._stats[this._rows[idxNew-1].key] = idxNew--; // update indices
			}

			if (idxNew != idxOld) {
				this._rows[idxNew].tr.before(stat.tr); // move table row

				// shift array back by one
				while (idxOld > idxNew) {
					this._rows[idxOld] = this._rows[idxOld-1];
					idxOld--;
				}

				this._rows[idxNew] = stat;

				//console.log(`${key}: ${this._stats[key]} => ${idxNew}`);
				this._stats[key] = idxNew;
			}
		} else {
			this.set(key, 1);
		}
	}
}


export { StatsBox, SortedStatsBox };
