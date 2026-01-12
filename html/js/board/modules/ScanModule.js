import { DataTableModule } from "#DashboardModule";


export class ScanModule extends DataTableModule {
	constructor(router, container, options) {
		super(router, ["journal:scan"], container, options);
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
