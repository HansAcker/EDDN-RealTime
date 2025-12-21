
// counts and displays named events or other information

class StatsRow {
	// TODO: shape-morphism optimization? #value is always a number except for two stats where it's a string
	#value;
	_key;

	#td;
	_tr;

	constructor(key, value) {
		const ktd = document.createElement("td");
		ktd.textContent = key;

		const td = document.createElement("td");
		this.#td = td;

		const tr = document.createElement("tr");
		tr.append(ktd, td);
		this._tr = tr;

		this._key = key;
		this._value = value;
	}

	set _value(newValue) {
		this.#td.textContent = this.#value = newValue;
	}

	get _value() {
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
			this._rows[this._stats[key]]._value = value;
		} else {
			const stat = new StatsRow(key, value);
			this.#statsbody.append(stat._tr);
			this._stats[key] = this._rows.length;
			this._rows.push(stat);
		}
	}

	inc(key) {
		if (this.has(key)) {
			this._rows[this._stats[key]]._value++;
		} else {
			this.set(key, 1);
		}
	}
}


// SortedStatsBox keeps _rows and table sorted

class SortedStatsBox extends StatsBox {
	// TODO: sort only moves counters up, not down
	set(key, value) {
		super.set(key, value);
		this._sort(key);
	}

	inc(key) {
		super.inc(key);
		this._sort(key);
	}

	// moves a single key upwards
	_sort(key) {
		const idxOld = this._stats[key];

		// already at the top
		if (idxOld <= 0) {
			return;
		}

		const stat = this._rows[idxOld];
		const value = stat._value;

		// won't move
		if (value <= this._rows[idxOld-1]._value) {
			return;
		}

		// find new position in rows array
		let idxNew = idxOld;
		do {
			this._stats[this._rows[idxNew-1]._key] = idxNew--; // update indices
		} while (idxNew > 0 && value > this._rows[idxNew-1]._value);

		// update rows
		this._rows[idxNew]._tr.before(stat._tr); // move table row
		this._rows.copyWithin(idxNew+1, idxNew, idxOld); // shift array back by one
		this._rows[idxNew] = stat; // re-insert element
		this._stats[key] = idxNew; // update index
	}
}


export { StatsBox, SortedStatsBox };
