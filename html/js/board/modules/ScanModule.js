import { DataTableModule } from "#DashboardModule";


export class ScanModule extends DataTableModule {
	constructor(router, container, options) {
		super(router, ["journal:scan"], container, options);
	}


	_handleEvent(event) {
		const row = this.makeRow(event);
		row.append(this.makeCell(event.message.BodyName), this.makeCell(event.message.ScanType));
		this.addRow(row);
	}
}


export default ScanModule;
