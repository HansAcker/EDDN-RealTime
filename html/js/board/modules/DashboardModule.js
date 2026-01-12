

export class DashboardModule {

	// TODO: allow empty topics for wildcard?
	constructor(router, topics) {
		if (router === undefined || topics === undefined) {
			throw new Error("DashboardModule: missing required arguments");
		}

		router.register((event) => this._handleEvent(event), topics);
	}


	_handleEvent(event) {
		// base class
		console.log(event.type, event.eventName, event.receiveTimestamp);
	}
}


export class DataTableModule extends DashboardModule {
	#renderQueue = []; // array of elements to add in next paint cycle
	#renderScheduled = false;

	_container;
	_infobox;

	_tableTemplate;
	_rowTemplate; // DOM elements to be cloned by makeCell()/makeRow()
	_cellTemplate;

	listLength = 20;
	cullFactor = 2; // cut back #renderQueue if > listLength * cullFactor // TODO: rename


	constructor(router, topics, container, options = {}) {
		const { listLength, cullFactor, template, infobox } = options;

		if (listLength && !Number.isInteger(listLength)) {
			throw new Error("listLength must be an integer");
		}

		if (cullFactor && isNaN(parseFloat(cullFactor))) {
			throw new Error("cullFactor must be a number");
		}

		super(router, topics);

		listLength && (this.listLength = listLength);
		cullFactor && (this.cullFactor = parseFloat(cullFactor));

		this._infobox = infobox;
		this._tableTemplate = template;

		// TODO: this calls _setupXX() in inheriting classes before their class definition is ready
		//       - Dashboard should call setup later
		this._container = this._setupContainer(container);
		this._setupTemplates();
	}


	_setupContainer(container) {
		if (!this._tableTemplate) {
			return container;
		}

		const table = document.importNode(this._tableTemplate.content, true);
		const tbody = table.querySelector("tbody"); // TODO: check
		tbody.innerHTML = "<tr><td>&nbsp;</td></tr>".repeat(this.listLength);

		container.replaceChildren(table);
		return tbody;
	}


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

		if (event.age > 3600 * 1000) {
			element.classList.add("old");
		} else if (event.age < 180 * -1000) {
			element.classList.add("new");
		}

		// key data by weak ref to table row, used in click event
		this._infobox?.set(element, event.data);

		return element;
	}


	_addRow(row) {
		// add row to queue
		this.#renderQueue.push(row);

		// drop overflowing rows eventually, the page is likely inactive
		const dropCount = this.#cutQueue(this.listLength, this.listLength * this.cullFactor);

		// only update the DOM when the page is on display and ready to paint
		if (!this.#renderScheduled && this.#renderQueue.length) {
			this.#renderScheduled = true;
			requestAnimationFrame(() => this.#render());
		}
	}


	#render() {
		this.#renderScheduled = false;

		let queueLength = this.#renderQueue.length;

		if (queueLength === 0) {
			console.warn("DashboardModule: render scheduled on empty queue");
			return;
		}

		if (this.#cutQueue(this.listLength)) {
			// clear table
			this._container.replaceChildren();
			queueLength = this.listLength;
		}

		// read current element count
		// TODO: when could childElementCount be !== listLength? usually, dropCount = queueLength
		const dropCount = (this._container.childElementCount + queueLength) - this.listLength;

		// batch updates into one DocumentFragment
		const fragment = document.createDocumentFragment();
		for (let i = 0; i < queueLength; i++) {
			fragment.prepend(this.#renderQueue[i]);
		}

		// reset queue
		this.#renderQueue.length = 0;

		// remove older rows from table
		// TODO: possibly use Range.deleteContents() here?
		if (dropCount > 0) {
			for (let i = 0; i < dropCount; i++) {
				this._container.lastElementChild?.remove();
			}
		}

		// insert new rows
		this._container.prepend(fragment);
	}


	#cutQueue(hardLimit, softLimit) {
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


export default DashboardModule;
