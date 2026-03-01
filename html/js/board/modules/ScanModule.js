/**
 * @module ScanModule
 * @description Dashboard module that displays all scan events from Elite Dangerous,
 * showing body names and scan types (Detailed, AutoScan, Basic, NavBeaconDetail).
 */

import { DataTableModule } from "#DashboardModule";


/**
 * Dashboard module that displays all scan events.
 *
 * @extends DataTableModule
 */
export class ScanModule extends DataTableModule {
	/**
	 * @param {MessageRouter} router - The {@link MessageRouter} to subscribe to.
	 * @param {Record<string, any>} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["journal:scan"], options);
	}


	/**
	 * Renders a row showing the body name and scan type.
	 *
	 * @param {EDDNEvent} event - The incoming {@link EDDNEvent}.
	 * @returns {DataTableModule~CellDescriptor[] | (() => DataTableModule~CellDescriptor[])} cells - Array of cell descriptors (strings, DOM nodes, or factory functions), or a callback returning such an array.
	 */
	_getCells(event) {
		return [
			event.message.BodyName,
			event.message.ScanType
		];
	}
}


export default ScanModule;
