import DashboardModule from "DashboardModule";


export class ScanModule extends DashboardModule {
	constructor(router, container, infobox) {
		super(router, ["journal:scan"], container, infobox);
	}

	_handleEvent(event) {
		const row = this.makeRow(event);
		row.append(this.makeCell(event.message.BodyName), this.makeCell(event.message.ScanType));
		this.addRow(row);
	}
}


export default ScanModule;
