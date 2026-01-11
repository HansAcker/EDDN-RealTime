import { DataTableModule } from "#DashboardModule";


export class UpdatesModule extends DataTableModule {
	constructor(router, container, options) {
		super(router, ["commodity", "outfitting", "shipyard"], container, options);
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
