import { DataTableModule } from "#DashboardModule";


export class UpdatesModule extends DataTableModule {
	constructor(router, container, options) {
		super(router, ["commodity", "outfitting", "shipyard"], container, options);
	}


	_handleEvent(event) {
		const row = this._makeRow(event);
		const message = event.message;

		row.append(this._makeCell(message.commodities ? "Market" : message.ships ? "Shipyard" : message.modules ? "Outfitting" : ""),
			this._makeCell(message.stationName),
			this._makeCell(message.systemName));

		this._addRow(row);
	}
}


export default UpdatesModule;
