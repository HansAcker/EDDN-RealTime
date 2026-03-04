/**
 * @module UpdatesModule
 * @description Dashboard module that displays station update events from Elite
 * Dangerous, including commodity market data, outfitting, and shipyard updates.
 */

import { DataTableModule } from "#DashboardModule";


/**
 * Dashboard module that displays station update events (commodity, outfitting,
 * and shipyard data uploads).
 *
 * @extends DataTableModule
 */
export class UpdatesModule extends DataTableModule {
	/**
	 * @param {MessageRouter} router - The {@link MessageRouter} to subscribe to.
	 * @param {Record<string, any>} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["commodity", "outfitting", "shipyard"], options);
	}


	/**
	 * Renders a row showing the update type, station name, and system name.
	 *
	 * @param {EDDNEvent} event - The incoming {@link EDDNEvent}.
	 * @returns {DataTableModule~CellDescriptor[] | (() => DataTableModule~CellDescriptor[])} cells - Array of cell descriptors (strings, DOM nodes, or factory functions), or a callback returning such an array.
	 */
	_getCells(event) {
		const message = event.message;

		return [
			event.eventType === "commodity" ? "Market" :
			event.eventType === "shipyard" ? "Shipyard" :
			event.eventType === "outfitting" ? "Outfitting" :
			"",
			message.stationName,
			message.systemName
		];
	}
}


export default UpdatesModule;
