/**
 * @module statsbox
 * @description Provides table-based counters that track and display named
 * statistics. {@link StatsBox} offers insertion-order display while
 * {@link SortedStatsBox} keeps rows sorted by descending value.
 */

// counts and displays named events or other information


/**
 * Default factory that creates a `<tr>` element containing the given children.
 *
 * @param {...Node} children - Child nodes to append to the row.
 * @returns {HTMLTableRowElement}
 */
const defaultRowFactory = (...children) => { const row = document.createElement("tr"); row.append(...children); return row; };

/**
 * Default factory that creates a `<td>` element with the given text content.
 *
 * @param {string} [textContent] - Text to display in the cell.
 * @returns {HTMLTableCellElement}
 */
const defaultCellFactory = (textContent) => { const cell = document.createElement("td"); cell.textContent = textContent ?? ""; return cell; };


/**
 * Represents a single statistics row in a {@link StatsBox}, consisting of
 * a key label and a value that is displayed in a table cell.
 */
class StatsRow {
	// TODO: shape-morphism optimization? #value is always a number except for two stats where it's a string
	#value = 0;
	_key;

	#cell;
	_row;

	/**
	 * Creates a new StatsRow.
	 *
	 * @param {string} key - The label for this statistic.
	 * @param {number|string} value - The initial value.
	 * @param {Function} rowFactory - Factory that creates the `<tr>` element.
	 * @param {Function} cellFactory - Factory that creates `<td>` elements.
	 */
	constructor(key, value, rowFactory, cellFactory) {
		const kcell = cellFactory(key);

		const vcell = cellFactory();
		this.#cell = vcell;

		this._key = key;
		this._value = value;

		this._row = rowFactory(kcell, vcell);
	}

	/**
	 * Sets the value for this statistic and updates the display cell.
	 *
	 * @param {number|string} newValue - The new value to assign.
	 */
	set _value(newValue) {
		this.#cell.textContent = this.#value = newValue;
	}

	/**
	 * Gets the current value of this statistic.
	 *
	 * @returns {number|string} The current value.
	 */
	get _value() {
		return this.#value;
	}
}


/**
 * A keyed collection of {@link StatsRow} instances rendered into a `<tbody>`.
 * Supports setting values by key and incrementing counters.
 */
class StatsBox {
	_stats = new Map(); // indices into rows
	_rows = []; // array of StatsRow

	#statsbody;
	#cellFactory = (textContent) => defaultCellFactory(textContent);
	#rowFactory = (...children) => defaultRowFactory(...children);

	/**
	 * Creates a new StatsBox.
	 *
	 * @param {HTMLTableSectionElement} tbody - The `<tbody>` element to render rows into.
	 * @param {object} [options={}] - Configuration options.
	 * @param {Object<string, number|string>} [options.values] - Initial key/value pairs.
	 * @param {Function} [options.rowFactory] - Custom row factory.
	 * @param {Function} [options.cellFactory] - Custom cell factory.
	 */
	constructor(tbody, options = {}) {
		tbody.replaceChildren(); // clear existing table content
		this.#statsbody = tbody;

		const { values, rowFactory, cellFactory } = options;

		this.#rowFactory = rowFactory ?? this.#rowFactory;
		this.#cellFactory = cellFactory ?? this.#cellFactory;

		for (const key in values) {
			this.set(key, values[key]);
		}
	}

	/**
	 * Checks whether a statistic with the given key exists.
	 *
	 * @param {string} key - The statistic name.
	 * @returns {boolean}
	 */
	has(key) {
		return this._stats.has(key);
	}

	/**
	 * Sets the value for a statistic, creating a new row if the key does not
	 * already exist.
	 *
	 * @param {string} key - The statistic name.
	 * @param {number|string} value - The value to display.
	 */
	set(key, value) {
		if (this.has(key)) {
			this._rows[this._stats.get(key)]._value = value;
		} else {
			const stat = new StatsRow(key, value, this.#rowFactory, this.#cellFactory);
			this._stats.set(key, this._rows.length);
			this._rows.push(stat);
			this.#statsbody.append(stat._row);
		}
	}

	/**
	 * Increments the value for a statistic by one, creating it with value `1`
	 * if the key does not already exist.
	 *
	 * @param {string} key - The statistic name.
	 */
	inc(key) {
		if (this.has(key)) {
			this._rows[this._stats.get(key)]._value++;
		} else {
			this.set(key, 1);
		}
	}
}


/**
 * A {@link StatsBox} subclass that keeps rows sorted in descending order
 * by value. Only moves rows upward (new or increased values).
 *
 * @extends StatsBox
 */
// SortedStatsBox keeps _rows and table sorted

class SortedStatsBox extends StatsBox {
	/**
	 * Sets a value and re-sorts the affected row upward if necessary.
	 *
	 * @param {string} key - The statistic name.
	 * @param {number|string} value - The value to display.
	 */
	// TODO: sort only moves counters up, not down
	set(key, value) {
		super.set(key, value);
		this._sort(key);
	}

	/**
	 * Increments a value and re-sorts the affected row upward if necessary.
	 *
	 * @param {string} key - The statistic name.
	 */
	inc(key) {
		super.inc(key);
		this._sort(key);
	}

	/**
	 * Moves the row identified by `key` upward in the array and DOM until it
	 * is in its correct sorted position.
	 *
	 * @param {string} key - The statistic name whose row should be re-sorted.
	 */
	// moves a single key upwards
	_sort(key) {
		const idxOld = this._stats.get(key);

		// not present or already at the top
		if (idxOld === undefined || idxOld <= 0) {
			return;
		}

		const stat = this._rows[idxOld];
		const value = stat._value;
		let idxNew = idxOld - 1;

		// won't move
		if (value <= this._rows[idxNew]._value) {
			return;
		}

		// find new position in rows array
		while (idxNew > 0 && value > this._rows[idxNew-1]._value) {
			idxNew--;
		}

		// update rows
		const rowRef = this._rows[idxNew]._row; // DOM element at this position
		this._rows.copyWithin(idxNew+1, idxNew, idxOld); // shift array back by one
		this._rows[idxNew] = stat; // re-insert element

		// update indices
		this._stats.set(key, idxNew);
		for (let i = idxNew+1; i <= idxOld; i++) {
			this._stats.set(this._rows[i]._key, i);
		}

		rowRef.before(stat._row); // update the DOM last
	}
}


export { StatsBox, SortedStatsBox };
