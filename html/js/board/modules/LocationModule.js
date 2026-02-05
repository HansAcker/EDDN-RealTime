import { DataTableModule } from "#DashboardModule";


export class LocationModule extends DataTableModule {
	constructor(router, options) {
		super(router, ["journal:location", "journal:docked"], options);
	}


	_handleEvent(event) {
		const message = event.message;
		this._addRow({ event, cells: [ message.StationName, message.StationType, event.StarSystem ]});
	}
}


export default LocationModule;
