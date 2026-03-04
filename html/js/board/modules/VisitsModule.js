/**
 * @module VisitsModule
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
	 * @param {Record<string, any>} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["journal:fsdjump"], options);
	}


	/**
	 * Skip event processing for jumps into uninhabited and uncontrolled systems.
	 *
	 * @param {EDDNEvent} event - The incoming {@link EDDNEvent}.
	 */
	_handleEvent(event) {
		const message = event.message;

		if (message.Population > 0 || message.SystemAllegiance) {
			super._handleEvent(event);
		}
	}


	/**
	 * Renders a row for jumps into populated systems, showing system name,
	 * population, allegiance, controlling faction, and faction state.
	 *
	 * @param {EDDNEvent} event - The incoming {@link EDDNEvent}.
	 * @returns {DataTableModule~CellDescriptor[] | (() => DataTableModule~CellDescriptor[])} cells - Array of cell descriptors (strings, DOM nodes, or factory functions), or a callback returning such an array.
	 */
	_getCells(event) {
		const message = event.message;
		const faction = message.SystemFaction ?? {};

		return () => [
			event.StarSystem,
			Config._numberFormat.format(message.Population ?? 0),
			message.SystemAllegiance,
			faction.Name,
			faction.FactionState
		];
	}
}


export default VisitsModule;
