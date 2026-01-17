import { DataTableModule } from "#DashboardModule";


export class LocationModule extends DataTableModule {
	constructor(router, options) {
		super(router, ["journal:location", "journal:docked"], options);
	}


	_handleEvent(event) {
		const row = this._makeRow(event);
		const message = event.message;
		row.append(this._makeCell(message.StationName ?? ""), this._makeCell(message.StationType ?? ""), this._makeCell(event.StarSystem));
		this._addRow(row);
	}
}


export default LocationModule;
