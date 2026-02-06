import { DataTableModule } from "#DashboardModule";


/**
 * Dashboard module that displays approach settlement events.
 *
 * @extends DataTableModule
 */
export class ApproachModule extends DataTableModule {
	/**
	 * @param {MessageRouter} router - The message router to subscribe to.
	 * @param {Object} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["approachsettlement"], options);
	}


	/**
	 * Renders a row showing the settlement name and star system.
	 *
	 * @param {EDDNEvent} event - The incoming EDDN event.
	 */
	_handleEvent(event) {
		this._addRow({ event, cells: [ event.message.Name, event.StarSystem ]});
	}
}


export default ApproachModule;
