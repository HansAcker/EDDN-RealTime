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

		const row = this._makeRow(event);
		row.append(
			this._makeCell(message.BodyName),
			this._makeCell(message.PlanetClass),
			this._makeCell(message.AtmosphereType && message.AtmosphereType !== "None" ? message.AtmosphereType : ""),
			this._makeCell(message.Landable ? "Yes" : "")
		);

		this._addRow(row);
	}
}


export default NewBodiesModule;
