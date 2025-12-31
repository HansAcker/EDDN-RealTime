export class DashboardModule {
	_container;
	_infobox;

	listLength = 20;

	constructor(eddnClient, topics = [], container, infobox, options = {}) {
		// TODO: deconstruct specific options
		Object.assign(this, options);

		this._eddnClient = eddnClient;
		this._container = container;
		this._infobox = infobox;

		for (const topic of topics) {
			this._eddnClient.addEventListener(topic, (event) => this._handleEvent(event));
		}
	}

	_handleEvent(event) {
		// base class
		console.log(event.type, event.timestamp);
	}

	makeCell(textContent) {
		const div = document.createElement("div");
		div.classList.add("dashboard__table--cell");
		div.setAttribute("role", "cell");
		div.textContent = div.title = textContent;
		return div;
	}

	makeRow(event) {
		const div = document.createElement("div");
		div.classList.add("dashboard__table--row");
		div.setAttribute("role", "row");
		div.classList.add("data");

        div.classList.add(event.gameType);

		if (event.isTaxi) {
			div.classList.add("taxi");
		}

		if (event.isMulticrew) {
			div.classList.add("multicrew");
		}

		if (event.isOld) {
			div.classList.add("old");
		} else if (event.isNew) {
			div.classList.add("new");
		}

		// key data by weak ref to table row, used in click event
		this._infobox?.set(div, event.data);

		return div;
	}

	addRow(row) {
		while (this._container.childElementCount >= this.listLength) {
			this._container.lastElementChild.remove();
		}

		this._container.prepend(row);
	}
}


export default DashboardModule;
