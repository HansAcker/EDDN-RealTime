/**
 * @module FSDJumpModule
 * @description Dashboard module that displays FSD (Frame Shift Drive) jump events
 * showing the destination star system from Elite Dangerous journal events.
 */

import { DataTableModule } from "#DashboardModule";


/**
 * Dashboard module that displays FSD jump events showing the destination
 * star system.
 *
 * @extends DataTableModule
 */
export class FSDJumpModule extends DataTableModule {
	/**
	 * @param {MessageRouter} router - The {@link MessageRouter} to subscribe to.
	 * @param {Record<string, any>} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["journal:fsdjump"], options);
	}


	/**
	 * Renders a row showing the star system name.
	 *
	 * @param {EDDNEvent} event - The incoming {@link EDDNEvent}.
	 */
	_handleEvent(event) {
		this._addRow({ event, cells: [ event.StarSystem ]});
	}
}


export default FSDJumpModule;
