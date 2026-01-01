export class DashboardModule {
	#topics; // Set of subscribed topics

	_container;
	_infobox;

	listLength = 20;

	constructor(eddnClient, topics = [], container, infobox, options = {}) {
		// TODO: deconstruct specific options
		Object.assign(this, options);

		this._eddnClient = eddnClient;
		this._container = this._setupContainer(container);
		this._infobox = infobox;

		this.#topics = new Set(topics);

		this._eddnClient.addEventListener("eddn:message", (event) => this.#routeEvent(event));
	}

	#routeEvent(event) {
		// TODO: move to a mediator that only executes the subscribed modules
		if (this.#topics.has(event.eventType) || this.#topics.has("*")) {
			this._handleEvent(event);
		}
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
		while (this._container.childElementCount >= this.listLength) {
			this._container.lastElementChild.remove();
		}

		this._container.prepend(row);
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

	makeRow(event, elementType = "div") {
		return super.makeRow(event, elementType);
	}
}


export default DashboardModule;
