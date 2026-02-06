import { DataTableModule } from "#DashboardModule";


/**
 * Dashboard module that displays location and docking events.
 *
 * @extends DataTableModule
 */
export class LocationModule extends DataTableModule {
	/**
	 * @param {MessageRouter} router - The message router to subscribe to.
	 * @param {Object} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["journal:location", "journal:docked"], options);
	}


	/**
	 * Renders a row showing station name, station type, and star system.
	 *
	 * @param {EDDNEvent} event - The incoming EDDN event.
	 */
	_handleEvent(event) {
		const message = event.message;
		this._addRow({ event, cells: [ message.StationName, message.StationType, event.StarSystem ]});
	}
}


export default LocationModule;
