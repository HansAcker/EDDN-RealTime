import DashboardModule from "DashboardModule";


export class UpdatesModule extends DashboardModule {
	constructor(router, container, infobox) {
		super(router, ["commodity", "outfitting", "shipyard"], container, infobox);
	}

	_handleEvent(event) {
		const row = this.makeRow(event);
		const message = event.message;

		row.append(this.makeCell(message.commodities ? "Market" : message.ships ? "Shipyard" : message.modules ? "Outfitting" : ""),
			this.makeCell(message.stationName),
			this.makeCell(message.systemName));

		this.addRow(row);
	}
}


export default UpdatesModule;
