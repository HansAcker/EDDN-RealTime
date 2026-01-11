import { DataTableModule } from "#DashboardModule";


export class LocationModule extends DataTableModule {
	constructor(router, container, options) {
		super(router, ["journal:location", "journal:docked"], container, options);
	}


	_handleEvent(event) {
		const row = this.makeRow(event);
		const message = event.message;
		row.append(this.makeCell(message.StationName ?? ""), this.makeCell(message.StationType ?? ""), this.makeCell(event.StarSystem));
		this.addRow(row);
	}
}


export default LocationModule;
