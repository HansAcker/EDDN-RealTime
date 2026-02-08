/**
 * @module board/modules/VisitsModule
 * @description Dashboard module that displays FSD jump events to populated or
 * allegiance systems from Elite Dangerous, showing population, faction information,
 * and system state data.
 */

import { Config } from "#config.js";
import { DataTableModule } from "#DashboardModule";


/**
 * Dashboard module that displays FSD jump events to populated or allegiance
 * systems, showing population and faction information.
 *
 * @extends DataTableModule
 */
export class VisitsModule extends DataTableModule {
	/**
	 * @param {MessageRouter} router - The {@link MessageRouter} to subscribe to.
	 * @param {Object} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["journal:fsdjump"], options);
	}


	/**
	 * Renders a row for jumps into populated systems, showing system name,
	 * population, allegiance, controlling faction, and faction state.
	 *
	 * @param {EDDNEvent} event - The incoming EDDN event.
	 */
	_handleEvent(event) {
		const message = event.message;
		if (message.Population > 0 || message.SystemAllegiance) {
			const faction = message.SystemFaction ?? {};

			this._addRow({ event, cells: [
				event.StarSystem,
				Config._numberFormat.format(message.Population ?? 0),
				message.SystemAllegiance,
				faction.Name,
				faction.FactionState
			]});
		}
	}
}


export default VisitsModule;
