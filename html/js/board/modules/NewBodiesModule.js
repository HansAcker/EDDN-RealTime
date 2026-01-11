import { DataTableModule } from "#DashboardModule";


export class NewBodiesModule extends DataTableModule {
	constructor(router, container, options) {
		super(router, ["journal:scan"], container, options);
	}


	_handleEvent(event) {
		const message = event.message;
		if (!(message.WasDiscovered === false && message.WasMapped === false && message.ScanType !== "NavBeaconDetail")) {
			return;
		}

		if (!message.PlanetClass) {
			return;
		}

		const row = this.makeRow(event);
		row.append(
			this.makeCell(message.BodyName),
			this.makeCell(message.PlanetClass),
			this.makeCell(message.AtmosphereType && message.AtmosphereType !== "None" ? message.AtmosphereType : ""),
			this.makeCell(message.Landable ? "Yes" : "")
		);

		this.addRow(row);
	}
}


export default NewBodiesModule;
