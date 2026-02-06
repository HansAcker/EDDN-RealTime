import { DataTableModule } from "#DashboardModule";


/**
 * Dashboard module that displays FSD jump events showing the destination
 * star system.
 *
 * @extends DataTableModule
 */
export class FSDJumpModule extends DataTableModule {
	/**
	 * @param {MessageRouter} router - The message router to subscribe to.
	 * @param {Object} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["journal:fsdjump"], options);
	}


	/**
	 * Renders a row showing the star system name.
	 *
	 * @param {EDDNEvent} event - The incoming EDDN event.
	 */
	_handleEvent(event) {
		this._addRow({ event, cells: [ event.StarSystem ]});
	}
}


export default FSDJumpModule;
