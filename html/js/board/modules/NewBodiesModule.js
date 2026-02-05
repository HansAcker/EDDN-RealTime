import { DataTableModule } from "#DashboardModule";


export class NewBodiesModule extends DataTableModule {
	constructor(router, options) {
		super(router, ["journal:scan"], options);
	}


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
