import { DataTableModule } from "#DashboardModule";


export class ScanModule extends DataTableModule {
	constructor(router, options) {
		super(router, ["journal:scan"], options);
	}


	_handleEvent(event) {
		const row = this._makeRow(event);
		row.append(
			this._makeCell(event.message.BodyName),
			this._makeCell(event.message.ScanType)
		);
		this._addRow(row);
	}
}


export default ScanModule;
