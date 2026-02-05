import { Config } from "#config.js";


export class DashboardModule {
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


	_handleEvent(_event) {
		// base class
	}
}


// TODO: keep and re-use a pool of DOM nodes?

export class DataTableModule extends DashboardModule {
	static DATA_KEY = Symbol(); // unique key for event data in DOM node namespace

	#renderQueue = []; // array of elements to add in next paint cycle
	#renderScheduled = false;

	_container;

	_tableTemplate;
	_rowTemplate; // DOM elements to be cloned by makeCell()/makeRow()
	_cellTemplate;

	listLength = Config.listLength ?? 20;
	cullFactor = 2; // cut back #renderQueue if > listLength * cullFactor // TODO: rename


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


	// TODO: define a full row in the template with slots for content?
	_setupTemplates() {
		// row Template
		this._rowTemplate = document.createElement("tr");
		this._rowTemplate.classList.add("data");

		// cell Template
		this._cellTemplate = document.createElement("td");
	}


	_makeCell(textContent = "") {
		const element = this._cellTemplate.cloneNode(false);
		element.textContent = element.title = textContent;
		return element;
	}


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


	_addRow(row) {
		// add row to queue
		this.#renderQueue.push(row);

		// drop overflowing rows eventually, the page is likely inactive
		this.#trimQueue(this.listLength, this.listLength * this.cullFactor);

		// only update the DOM when the page is on display and ready to paint
		if (!this.#renderScheduled && this.#renderQueue.length) {
			this.#renderScheduled = true;
			requestAnimationFrame(() => this.#render());
		}
	}


	#render() {
		this.#renderScheduled = false;

		if (!this.#renderQueue.length) {
			console.warn("DataTableModule: render scheduled on empty queue");
			return;
		}

		// clear table for full replacement if queueLength > listLength
		if (this.#trimQueue(this.listLength)) {
			this._container.replaceChildren();
		}

		// read current element count
		const dropCount = (this._container.childElementCount + this.#renderQueue.length) - this.listLength;

		// batch updates into one DocumentFragment
		const fragment = document.createDocumentFragment();
		for (const item of this.#renderQueue) {
			const { event, cells } = item;

			// TODO: check that `event instanceof EDDNEvent`?
			if (!event || !Array.isArray(cells)) {
				console.warn("DataTableModule: missing or invalid properties in render queue item");
				continue;
			}

			// TODO: support full row/rowFactory in queue?
			const newRow = this._makeRow(event);

			for (const cell of cells) {
				newRow.append((cell instanceof Node) ? cell : this._makeCell(cell ?? ""));
			}

			// store event data reference within node namespace
			newRow[DataTableModule.DATA_KEY] = event.data;

			fragment.prepend(newRow);
		}

		// reset queue
		this.#renderQueue.length = 0;

		// remove older rows from table
		if (dropCount > 0) {
			for (let i = 0; i < dropCount; i++) {
				this._container.lastElementChild?.remove();
			}
		}

		// insert new rows
		this._container.prepend(fragment);
	}


	#trimQueue(hardLimit, softLimit) {
		const queueLength = this.#renderQueue.length;

		if (queueLength > (softLimit ?? hardLimit)) {
			const dropCount = queueLength - hardLimit;

			// move queue tail up front ([dropCount]... -> [0]...)
			this.#renderQueue.copyWithin(0, dropCount);
			this.#renderQueue.length = hardLimit;

			return dropCount;
		}

		return 0;
	}
}


export class DummyTableModule extends DataTableModule {
	constructor(router, options) {
		super(null, null, options);
	}
}


export default DashboardModule;
