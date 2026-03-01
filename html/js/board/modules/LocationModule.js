/**
 * @module LocationModule
 * @description Dashboard module that displays location and docking events from
 * Elite Dangerous, showing station names, station types, and star systems.
 */

import { DataTableModule } from "#DashboardModule";


/**
 * Dashboard module that displays location and docking events.
 *
 * @extends DataTableModule
 */
export class LocationModule extends DataTableModule {
	/**
	 * @param {MessageRouter} router - The {@link MessageRouter} to subscribe to.
	 * @param {Record<string, any>} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["journal:location", "journal:docked"], options);
	}


	/**
	 * Renders a row showing station name, station type, and star system.
	 *
	 * @param {EDDNEvent} event - The incoming {@link EDDNEvent}.
	 * @returns {DataTableModule~CellDescriptor[] | (() => DataTableModule~CellDescriptor[])} cells - Array of cell descriptors (strings, DOM nodes, or factory functions), or a callback returning such an array.
	 */
	_getCells(event) {
		const message = event.message;
		return [ message.StationName, message.StationType, event.StarSystem ];
	}
}


export default LocationModule;
