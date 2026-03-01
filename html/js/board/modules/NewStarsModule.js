/**
 * @module NewStarsModule
 * @description Dashboard module that displays newly discovered (unmapped) stars
 * from Elite Dangerous scan events. Filters out previously discovered or mapped
 * bodies and NavBeacon scans, showing only stars (stellar bodies).
 */

import { DataTableModule } from "#DashboardModule";


/**
 * Dashboard module that displays newly discovered (unmapped) stars.
 *
 * @extends DataTableModule
 */
export class NewStarsModule extends DataTableModule {
	/**
	 * @param {MessageRouter} router - The {@link MessageRouter} to subscribe to.
	 * @param {Record<string, any>} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["journal:scan"], options);
	}


	/**
	 * Skip event processing if the body was already discovered or pre-known.
	 *
	 * @param {EDDNEvent} event - The incoming {@link EDDNEvent}.
	 */
	_handleEvent(event) {
		const message = event.message;

		// NavBeaconDetail can return scans for undiscoverable/unmappable bodies
		if (message.WasDiscovered !== false || message.WasMapped !== false || message.ScanType === "NavBeaconDetail") {
			return;
		}

		if (!message.StarType) {
			return;
		}

		super._handleEvent(event);
	}

	/**
	 * Renders a row for undiscovered stars, filtering out previously
	 * discovered bodies, mapped bodies, and NavBeacon scans.
	 *
	 * @param {EDDNEvent} event - The incoming {@link EDDNEvent}.
	 * @returns {DataTableModule~CellDescriptor[] | (() => DataTableModule~CellDescriptor[])} cells - Array of cell descriptors (strings, DOM nodes, or factory functions), or a callback returning such an array.
	 */
	_getCells(event) {
		const message = event.message;

		return [
			message.BodyName,
			`${message.StarType} ${message.Subclass}`
		];
	}
}


export default NewStarsModule;
