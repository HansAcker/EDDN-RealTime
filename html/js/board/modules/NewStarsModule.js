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

		const row = this._makeRow(event);
		row.append(
			this._makeCell(message.BodyName),
			this._makeCell(`${message.StarType} ${message.Subclass}`)
		);

		this._addRow(row);
	}
}


export default NewStarsModule;
