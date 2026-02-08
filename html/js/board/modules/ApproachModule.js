/**
 * @module board/modules/ApproachModule
 * @description Dashboard module that displays approach settlement events from
 * Elite Dangerous, showing settlement names and their star systems.
 */

import { DataTableModule } from "#DashboardModule";


/**
 * Dashboard module that displays approach settlement events.
 *
 * @extends {@link DataTableModule}
 */
export class ApproachModule extends DataTableModule {
	/**
	 * @param {@link module:eddn/MessageRouter} router - The message router to subscribe to.
	 * @param {Object} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["approachsettlement"], options);
	}


	/**
	 * Renders a row showing the settlement name and star system.
	 *
	 * @param {@link module:eddn/EDDNEvent} event - The incoming EDDN event.
	 */
	_handleEvent(event) {
		this._addRow({ event, cells: [ event.message.Name, event.StarSystem ]});
	}
}


export default ApproachModule;
