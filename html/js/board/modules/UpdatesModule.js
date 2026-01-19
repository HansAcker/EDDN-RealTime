import { DataTableModule } from "#DashboardModule";


export class UpdatesModule extends DataTableModule {
	constructor(router, options) {
		super(router, ["commodity", "outfitting", "shipyard"], options);
	}


	_handleEvent(event) {
		const row = this._makeRow(event);
		const message = event.message;

		row.append(
			this._makeCell(
				event.eventType === "commodity" ? "Market" :
				event.eventType === "shipyard" ? "Shipyard" :
				event.eventType === "outfitting" ? "Outfitting" :
				""
			),
			this._makeCell(message.stationName),
			this._makeCell(message.systemName)
		);

		this._addRow(row);
	}
}


export default UpdatesModule;
