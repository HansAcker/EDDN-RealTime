
// counts and displays named events or other information

//import { makeCell } from "./utils.js";

const makeCell = (textContent) => { const div = document.createElement("div"); div.classList.add("dashboard__table--cell"); div.setAttribute("role", "cell"); div.textContent = div.title = textContent; return div; };

class StatsRow {
	// TODO: shape-morphism optimization? #value is always a number except for two stats where it's a string
	#value = 0;
	_key;

	#cell;
	_row;

	constructor(key, value) {
		const kcell = makeCell(key);

		const vcell = makeCell(value);
		this.#cell = vcell;

		const row = document.createElement("div");
		row.classList.add("dashboard__table--row");
		row.append(kcell, vcell);
		this._row = row;

		this._key = key;
		this._value = value;
	}

	set _value(newValue) {
		this.#cell.textContent = this.#cell.title = this.#value = newValue;
	}

	get _value() {
		return this.#value;
	}
}


class StatsBox {
	#statsbody;
	_stats = new Map(); // indices into rows
	_rows = []; // array of StatsRow

	constructor(tbody, values = {}) {
		tbody.replaceChildren(); // clear existing table content
		this.#statsbody = tbody;

		for (const key in values) {
			this.set(key, values[key]);
		}
	}

	has(key) {
		return this._stats.has(key);
	}

	set(key, value) {
		if (this.has(key)) {
			this._rows[this._stats.get(key)]._value = value;
		} else {
			const stat = new StatsRow(key, value);
			this.#statsbody.append(stat._row);
			this._stats.set(key, this._rows.length);
			this._rows.push(stat);
		}
	}

	inc(key) {
		if (this.has(key)) {
			this._rows[this._stats.get(key)]._value++;
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
		const idxOld = this._stats.get(key);

		// not present or already at the top
		if (idxOld === undefined || idxOld <= 0) {
			return;
		}

		const stat = this._rows[idxOld];
		const value = stat._value;

		// won't move
		if (value <= this._rows[idxOld-1]._value) {
			return;
		}

		// find new position in rows array
		let idxNew = idxOld - 1;
		while (idxNew > 0 && value > this._rows[idxNew-1]._value) {
			idxNew--;
		}

		// update indices
		for (let i = idxNew; i < idxOld; i++) {
			this._stats.set(this._rows[i]._key, i+1);
		}

		this._stats.set(key, idxNew);

		const rowRef = this._rows[idxNew]._row; // DOM element

		// update rows
		this._rows.copyWithin(idxNew+1, idxNew, idxOld); // shift array back by one
		this._rows[idxNew] = stat; // re-insert element

		rowRef.before(stat._row); // update the DOM last
	}
}


export { StatsBox, SortedStatsBox };
