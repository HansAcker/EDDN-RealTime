/**
 * @module board/modules/FSDJumpModule
 * @description Dashboard module that displays FSD (Frame Shift Drive) jump events
 * showing the destination star system from Elite Dangerous journal events.
 */

import { DataTableModule } from "#DashboardModule";


/**
 * Dashboard module that displays FSD jump events showing the destination
 * star system.
 *
 * @extends {@link DataTableModule}
 */
export class FSDJumpModule extends DataTableModule {
	/**
	 * @param {@link module:eddn/MessageRouter} router - The message router to subscribe to.
	 * @param {Object} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["journal:fsdjump"], options);
	}


	/**
	 * Renders a row showing the star system name.
	 *
	 * @param {@link module:eddn/EDDNEvent} event - The incoming EDDN event.
	 */
	_handleEvent(event) {
		this._addRow({ event, cells: [ event.StarSystem ]});
	}
}


export default FSDJumpModule;
