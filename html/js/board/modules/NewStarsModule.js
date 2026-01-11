import { DataTableModule } from "#DashboardModule";


export class NewStarsModule extends DataTableModule {
	constructor(router, container, options) {
		super(router, ["journal:scan"], container, options);
	}


	_handleEvent(event) {
		const message = event.message;
		if (!(message.WasDiscovered === false && message.WasMapped === false && message.ScanType !== "NavBeaconDetail")) {
			return;
		}

		if (!message.StarType) {
			return;
		}

		const row = this.makeRow(event);
		row.append(
			this.makeCell(message.BodyName),
			this.makeCell(`${message.StarType} ${message.Subclass}`)
		);

		this.addRow(row);
	}
}


export default NewStarsModule;
