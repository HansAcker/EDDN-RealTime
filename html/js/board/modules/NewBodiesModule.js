/**
 * @module NewBodiesModule
 * @description Dashboard module that displays newly discovered (unmapped) planetary
 * bodies from Elite Dangerous scan events. Filters out previously discovered or
 * mapped bodies and NavBeacon scans.
 */

import { DataTableModule } from "#DashboardModule";


/**
 * Dashboard module that displays newly discovered (unmapped) planetary bodies.
 *
 * @extends DataTableModule
 */
export class NewBodiesModule extends DataTableModule {
	/**
	 * @param {MessageRouter} router - The {@link MessageRouter} to subscribe to.
	 * @param {Object} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["journal:scan"], options);
	}


	/**
	 * Renders a row for undiscovered planets, filtering out previously
	 * discovered bodies, mapped bodies, and NavBeacon scans.
	 *
	 * @param {EDDNEvent} event - The incoming {@link EDDNEvent}.
	 */
	_handleEvent(event) {
		const message = event.message;
		if (!(message.WasDiscovered === false && message.WasMapped === false && message.ScanType !== "NavBeaconDetail")) {
			return;
		}

		if (!message.PlanetClass) {
			return;
		}

		this._addRow({ event, cells: [
			message.BodyName,
			message.PlanetClass,
			message.AtmosphereType && message.AtmosphereType !== "None" ? message.AtmosphereType : "",
			message.Landable ? "Yes" : ""
		]});
	}
}


export default NewBodiesModule;
