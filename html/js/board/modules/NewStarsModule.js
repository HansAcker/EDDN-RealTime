import { DataTableModule } from "#DashboardModule";


/**
 * Dashboard module that displays newly discovered (unmapped) stars.
 *
 * @extends DataTableModule
 */
export class NewStarsModule extends DataTableModule {
	/**
	 * @param {MessageRouter} router - The message router to subscribe to.
	 * @param {Object} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["journal:scan"], options);
	}


	/**
	 * Renders a row for undiscovered stars, filtering out previously
	 * discovered bodies, mapped bodies, and NavBeacon scans.
	 *
	 * @param {EDDNEvent} event - The incoming EDDN event.
	 */
	_handleEvent(event) {
		const message = event.message;
		if (!(message.WasDiscovered === false && message.WasMapped === false && message.ScanType !== "NavBeaconDetail")) {
			return;
		}

		if (!message.StarType) {
			return;
		}

		this._addRow({ event, cells: [
			message.BodyName,
			`${message.StarType} ${message.Subclass}`
		]});
	}
}


export default NewStarsModule;
