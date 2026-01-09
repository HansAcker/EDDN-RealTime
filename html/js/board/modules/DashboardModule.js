export class DashboardModule {
	_container;
	_infobox;

	#renderQueue = [];
	#renderScheduled = false;

	listLength = 20;

	constructor(router, topics = [], container, infobox, options = {}) {
		// TODO: deconstruct specific options
		Object.assign(this, options);

		this._container = this._setupContainer(container);
		this._infobox = infobox;

		router.register((event) => this._handleEvent(event), topics);
	}

	_setupContainer(container) {
		// base class
		return container;
	}

	_handleEvent(event) {
		// base class
		console.log(event.type, event.eventType, event.timestamp);
	}

	makeCell(textContent, elementType = "div") {
		const element = document.createElement(elementType);
		element.classList.add("dashboard__table--cell");
		element.setAttribute("role", "cell");
		element.textContent = element.title = textContent;
		return element;
	}

	makeRow(event, elementType = "div") {
		const element = document.createElement(elementType);
		element.classList.add("dashboard__table--row");
		element.setAttribute("role", "row");
		element.classList.add("data");

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

		if (this.#renderQueue.length > this.listLength) {
			this.#renderQueue.shift();
		}

		this.#scheduleRender();
	}

	#scheduleRender() {
		if (this.#renderScheduled) return;
		this.#renderScheduled = true;

		// Wait for the next browser repaint
		requestAnimationFrame(() => this.#render());
	}

	#render() {
		const queueLength = this.#renderQueue.length;

		if (queueLength === 0) {
			this.#renderScheduled = false;
			return;
		}

		if (queueLength > this.listLength) {
			console.warn("DashboardModule: render queue overflow");
			this.#renderQueue = this.#renderQueue.slice(-this.listLength);
		}

		const listCount = this._container.childElementCount;
		const dropCount = (listCount + queueLength) - this.listLength;

		const fragment = document.createDocumentFragment();

		while (this.#renderQueue.length > 0) {
			fragment.prepend(this.#renderQueue.shift());
		}

		if (dropCount > 0) {
			for (let i = 0; i < dropCount; i++) {
				this._container.lastElementChild?.remove();
			}
		}

		this._container.prepend(fragment);

		this.#renderScheduled = false;
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

	makeCell(textContent, elementType = "td") {
		return super.makeCell(textContent, elementType);
	}

	makeRow(event, elementType = "tr") {
		return super.makeRow(event, elementType);
	}
}


export default DashboardModule;
