import { DataTableModule } from "#DashboardModule";


export class ScanModule extends DataTableModule {
	constructor(router, options) {
		super(router, ["journal:scan"], options);
	}


	_handleEvent(event) {
		this._addRow({ event, cells: [
			event.message.BodyName,
			event.message.ScanType
		]});
	}
}


export default ScanModule;
