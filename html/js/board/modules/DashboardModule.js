
export class DashboardModule {
	#renderQueue = []; // array of elements to add in next paint cycle
	#renderScheduled = false;

	_container;
	_infobox;

	_rowTemplate; // DOM elements to be cloned by makeCell()/makeRow()
	_cellTemplate;

	listLength = 20;
	cullFactor = 2; // cut back #renderQueue if > listLength * cullFactor // TODO: rename


	// TODO: - container, infobox into options
	//       - allow empty topics for wildcard?
	constructor(router, topics, container, infobox, options = {}) {
		if (router === undefined || topics === undefined) {
			throw new Error("DashboardModule: missing required arguments");
		}

		// TODO: deconstruct specific options
		Object.assign(this, options);

		this._container = this._setupContainer(container);
		this._setupTemplates();

		this._infobox = infobox;

		router.register((event) => this._handleEvent(event), topics);
	}


	_setupContainer(container) {
		// base class
		return container;
	}

	_setupTemplates() {
		// row Template
		this._rowTemplate = document.createElement("div");
		this._rowTemplate.classList.add("dashboard__table--row", "data");
		this._rowTemplate.setAttribute("role", "row");

		// cell Template
		this._cellTemplate = document.createElement("div");
		this._cellTemplate.classList.add("dashboard__table--cell");
		this._cellTemplate.setAttribute("role", "cell");
	}


	_handleEvent(event) {
		// base class
		console.log(event.type, event.eventType, event.timestamp);
	}


	makeCell(textContent) {
		const element = this._cellTemplate.cloneNode(false);
		element.textContent = element.title = textContent;
		return element;
	}


	makeRow(event) {
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


	addRow(row) {
		this.#renderQueue.push(row);

		// drop overflowing elements eventually, the page is likely inactive
		if (this.#renderQueue.length > this.listLength * this.cullFactor) {
			this.#renderQueue = this.#renderQueue.slice(-this.listLength);
		}

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

		if (queueLength > this.listLength) {
			this.#renderQueue = this.#renderQueue.slice(-this.listLength);
			queueLength = this.listLength;
		}

		// read current element count
		const dropCount = (this._container.childElementCount + queueLength) - this.listLength;

		// batch updates into one DocumentFragment
		const fragment = document.createDocumentFragment();
		for (let i = 0; i < queueLength; i++) {
			fragment.prepend(this.#renderQueue.shift());
		}

		// remove tail
		if (dropCount > 0) {
			for (let i = 0; i < dropCount; i++) {
				this._container.lastElementChild?.remove();
			}
		}

		// insert new rows
		this._container.prepend(fragment);
	}
}


export class DataTableModule extends DashboardModule {
	_setupContainer(container) {
		// insert table into container
		const table = document.createElement("table");
		// TODO: add classes, attributres, make it a web component, etc.
		container.replaceChildren(table);
		// TODO: fill with listLength?
		return table;
	}

	_setupTemplates() {
		// row Template
		this._rowTemplate = document.createElement("tr");
		this._rowTemplate.classList.add("dashboard__table--row", "data");
		this._rowTemplate.setAttribute("role", "row");

		// cell Template
		this._cellTemplate = document.createElement("td");
		this._cellTemplate.classList.add("dashboard__table--cell");
		this._cellTemplate.setAttribute("role", "cell");
	}
}


export default DashboardModule;
