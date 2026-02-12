/**
 * @module DashboardModule
 * @description Base class for all dashboard modules. Registers callbacks with the
 * {@link MessageRouter} for specified topics and delegates incoming
 * {@link EDDNEvent} events to subclass handlers. Includes specialized
 * {@link DataTableModule} for rendering table-based displays.
 */

import { Config } from "#config.js";


/**
 * Base class for all dashboard modules. Registers a callback with the
 * {@link MessageRouter} for the specified topics and delegates incoming
 * events to {@link DashboardModule#_handleEvent}.
 */
export class DashboardModule {
	/**
	 * Creates a new DashboardModule.
	 *
	 * @param {MessageRouter|null} router - The {@link MessageRouter} to subscribe to, or `null` for dummy modules.
	 * @param {string|Iterable<string>} topics - Topic(s) to subscribe to (e.g. `"journal:fsdjump"`, `"*"`).
	 */
	constructor(router, topics) {
		// allow empty router for DummyModule
		if (!router) {
			return;
		}

		// TODO: allow empty topic for wildcard?
		if (!topics) {
			throw new Error("DashboardModule: missing required arguments");
		}

		router.register((event) => this._handleEvent(event), topics);
	}


	/**
	 * Processes an incoming EDDN event. Override in subclasses to implement
	 * module-specific behaviour.
	 *
	 * @param {EDDNEvent} _event - The EDDN event to handle.
	 */
	_handleEvent(_event) {
		// base class
	}
}


/**
 * A {@link DashboardModule} subclass that renders incoming events as table
 * rows inside a `<tbody>`. Provides batched rendering via
 * `requestAnimationFrame`, overflow trimming, and helper methods for
 * constructing table cells and rows.
 *
 * @extends DashboardModule
 */
// TODO: keep and re-use a pool of DOM nodes?

export class DataTableModule extends DashboardModule {
	static DATA_KEY = Symbol(); // unique key for event data in DOM node namespace

	#renderQueue = []; // array of elements to add in next paint cycle
	#renderScheduled = false;
	#renderPaused = false;

	_container;

	_tableTemplate;
	_rowTemplate; // DOM elements to be cloned by makeCell()/makeRow()
	_cellTemplate;

	listLength = Config.listLength ?? 20;
	cullFactor = 2; // cut back #renderQueue if > listLength * cullFactor // TODO: rename


	/**
	 * Creates a new DataTableModule.
	 *
	 * @param {MessageRouter|null} router - The {@link MessageRouter} to subscribe to.
	 * @param {string|Iterable<string>|null} topics - Topic(s) to subscribe to.
	 * @param {{ listLength?: number, cullFactor?: number, template?: HTMLTemplateElement }} [options={}] - Configuration options.
	 */
	constructor(router, topics, options = {}) {
		const { listLength, cullFactor, template } = options;

		if (listLength && !Number.isInteger(listLength)) {
			throw new Error("listLength must be an integer");
		}

		if (cullFactor && isNaN(parseFloat(cullFactor))) {
			throw new Error("cullFactor must be a number");
		}

		super(router, topics);

		listLength && (this.listLength = listLength);
		cullFactor && (this.cullFactor = parseFloat(cullFactor));

		this._tableTemplate = template;

		// TODO: this calls _setupXX() in inheriting classes before their class definition is ready
		this._setupTemplates();
	}


	/** Pause/resume table rendering, schedule immediate re-paint on resume */
	set paused(pause) {
		// console.debug(this.constructor.name, pause ? "paused" : "resumed");
		this.#renderPaused = Boolean(pause);
		this.#scheduleRender();
	}


	/** @type {boolean} The current pause state */
	get paused() { return this.#renderPaused; }


	/**
	 * Clones the module's `<template>`, locates the `<tbody>`, fills it with
	 * placeholder rows if empty, and stores a reference for later rendering.
	 *
	 * @returns {DocumentFragment|null} The cloned template DOM, or `null` if no template is set.
	 */
	_setupContainer() {
		if (!this._tableTemplate) {
			return null;
		}

		const table = document.importNode(this._tableTemplate.content, true);
		const tbody = table.querySelector("tbody"); // TODO: check
		if (!tbody.childElementCount && this.listLength) {
			tbody.innerHTML = "<tr><td>&nbsp;</td></tr>".repeat(this.listLength);
		}

		this._container = tbody;
		return table;
	}


	/**
	 * Initialises the default row and cell template elements used by
	 * {@link DataTableModule#_makeRow} and {@link DataTableModule#_makeCell}.
	 */
	// TODO: define a full row in the template with slots for content?
	_setupTemplates() {
		// row Template
		this._rowTemplate = document.createElement("tr");
		this._rowTemplate.classList.add("data");

		// cell Template
		this._cellTemplate = document.createElement("td");
	}


	/**
	 * Creates a `<td>` element populated with the given text.
	 *
	 * @param {string} [textContent] - Text content for the cell.
	 * @returns {HTMLTableCellElement}
	 */
	_makeCell(textContent) {
		const element = this._cellTemplate.cloneNode(false);
		element.textContent = element.title = textContent ?? "";
		return element;
	}


	/**
	 * Creates a `<tr>` element styled according to the event's game type,
	 * taxi/multicrew status, and message age.
	 *
	 * @param {EDDNEvent} event - The {@link EDDNEvent} providing classification data.
	 * @returns {HTMLTableRowElement}
	 */
	_makeRow(event) {
		const element = this._rowTemplate.cloneNode(false);
		element.classList.add(event.gameType);

		if (event.isTaxi) {
			element.classList.add("taxi");
		}

		if (event.isMulticrew) {
			element.classList.add("multicrew");
		}

		if (event.age > Config.oldAge) {
			element.classList.add("old");
		} else if (event.age < Config.newAge) {
			element.classList.add("new");
		}

		return element;
	}


	/**
	 * Queues a new row for rendering. The row will be painted in the next
	 * animation frame.
	 *
	 * @param {{event: EDDNEvent, cells: Array<string|Node|Function>}} row - An object containing the source event and an array of cell descriptors.
	 */
	_addRow(row) {
		// add row to queue
		this.#renderQueue.push(row);

		// drop overflowing rows eventually, the page is likely inactive
		this.#trimQueue(this.listLength, this.listLength * this.cullFactor);

		this.#scheduleRender();
	}


	/**
	 * Schedule a re-paint if not paused
	 */
	#scheduleRender() {
		// only update the DOM when the page is on display and ready to paint
		if (!this.#renderPaused && !this.#renderScheduled && this.#renderQueue.length) {
			this.#renderScheduled = true;
			requestAnimationFrame(() => this.#render());
		}
	}


	/**
	 * Flushes the render queue into the DOM. Called via `requestAnimationFrame`.
	 */
	#render() {
		const queue = this.#renderQueue;
		const container = this._container;
		this.#renderScheduled = false;

		if (this.#renderPaused) {
			return;
		}

		if (!queue.length) {
			console.warn("DataTableModule: render scheduled on empty queue");
			return;
		}

		// clear table for full replacement if queueLength > listLength
		if (this.#trimQueue(this.listLength)) {
			container.replaceChildren();
		}

		// read current element count
		let dropCount = (container.childElementCount + queue.length) - this.listLength;

		// batch updates into one DocumentFragment
		const fragment = document.createDocumentFragment();
		for (const { event, cells } of queue) {

			// TODO: check that `event instanceof EDDNEvent`?
			if (!event || !Array.isArray(cells)) {
				console.warn("DataTableModule: missing or invalid properties in render queue item");
				dropCount && dropCount--;
				continue;
			}

			// TODO: support full row/rowFactory in queue?
			const newRow = this._makeRow(event);

			for (const cell of cells) {
				newRow.append(
					(cell instanceof Node) ? cell : // DOM element created in handler
					(typeof cell === "function") ? invoke(cell) ?? this._makeCell() : // callback into module
					this._makeCell(cell) // text string
				);
			}

			// store event data reference within node namespace
			newRow[DataTableModule.DATA_KEY] = event.data;

			fragment.prepend(newRow);
		}

		// reset queue
		queue.length = 0;

		// remove older rows from table
		if (dropCount > 0) {
			for (let i = 0; i < dropCount; i++) {
				container.lastElementChild?.remove();
			}
		}

		// insert new rows
		container.prepend(fragment);
	}


	/**
	 * Trims the render queue to at most `hardLimit` entries when the queue
	 * length exceeds `softLimit` (or `hardLimit` if `softLimit` is omitted).
	 *
	 * @param {number} hardLimit - Maximum queue length after trimming.
	 * @param {number} [softLimit] - Queue length threshold that triggers trimming.
	 * @returns {number} The number of dropped entries, or `0` if no trimming occurred.
	 */
	#trimQueue(hardLimit, softLimit) {
		const queue = this.#renderQueue;
		const queueLength = queue.length;

		if (queueLength > (softLimit ?? hardLimit)) {
			const dropCount = queueLength - hardLimit;

			// move queue tail up front ([dropCount]... -> [0]...)
			queue.copyWithin(0, dropCount);
			queue.length = hardLimit;

			return dropCount;
		}

		return 0;
	}
}


/**
 * A no-op {@link DataTableModule} subclass used for placeholder or
 * legend-only modules that do not subscribe to any events.
 *
 * @extends DataTableModule
 */
export class DummyTableModule extends DataTableModule {
	/**
	 * Creates a DummyTableModule that renders a static table without subscribing
	 * to any EDDN topics.
	 *
	 * @param {MessageRouter} router - Unused; passed as `null` to the parent.
	 * @param {Record<string, any>} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(null, null, options);
	}
}


/**
 * Safely invokes a cell callback, returning `undefined` on error.
 *
 * @param {() => Node} cb - The callback to execute.
 * @returns {Node|undefined} The result of the callback, or `undefined` if it threw.
 */
function invoke(cb) {
	try {
		return cb();
	} catch (err) {
		console.error("DataTableModule: Error in cell callback:", err);
		return undefined;
	}
}


export default DashboardModule;
