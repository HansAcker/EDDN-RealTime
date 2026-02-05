import { DataTableModule } from "#DashboardModule";


export class NewStarsModule extends DataTableModule {
	constructor(router, options) {
		super(router, ["journal:scan"], options);
	}


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
