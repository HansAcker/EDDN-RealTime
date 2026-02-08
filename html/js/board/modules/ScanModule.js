/**
 * @module board/modules/ScanModule
 * @description Dashboard module that displays all scan events from Elite Dangerous,
 * showing body names and scan types (Detailed, AutoScan, Basic, NavBeaconDetail).
 */

import { DataTableModule } from "#DashboardModule";


/**
 * Dashboard module that displays all scan events.
 *
 * @extends {@link DataTableModule}
 */
export class ScanModule extends DataTableModule {
	/**
	 * @param {@link MessageRouter} router - The message router to subscribe to.
	 * @param {Object} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["journal:scan"], options);
	}


	/**
	 * Renders a row showing the body name and scan type.
	 *
	 * @param {@link EDDNEvent} event - The incoming EDDN event.
	 */
	_handleEvent(event) {
		this._addRow({ event, cells: [
			event.message.BodyName,
			event.message.ScanType
		]});
	}
}


export default ScanModule;
