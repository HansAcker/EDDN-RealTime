import { DataTableModule } from "#DashboardModule";


export class UpdatesModule extends DataTableModule {
	constructor(router, options) {
		super(router, ["commodity", "outfitting", "shipyard"], options);
	}


	_handleEvent(event) {
		const message = event.message;

		this._addRow({ event, cells: [
			event.eventType === "commodity" ? "Market" :
			event.eventType === "shipyard" ? "Shipyard" :
			event.eventType === "outfitting" ? "Outfitting" :
			"",
			message.stationName,
			message.systemName
		]});
	}
}


export default UpdatesModule;
