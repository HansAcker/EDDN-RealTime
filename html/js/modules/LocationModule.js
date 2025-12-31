import DashboardModule from "DashboardModule";


export class LocationModule extends DashboardModule {
	constructor(eddnClient, container, infobox) {
		super(eddnClient, ["journal:location", "journal:docked"], container, infobox);
	}

	_handleEvent(event) {
		const row = this.makeRow(event);
		const message = event.message;
		row.append(this.makeCell(message.StationName ?? ""), this.makeCell(message.StationType ?? ""), this.makeCell(message.StarSystem));
		this.addRow(row);
	}
}

export default LocationModule;
