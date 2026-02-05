import { DataTableModule } from "#DashboardModule";


export class ApproachModule extends DataTableModule {
	constructor(router, options) {
		super(router, ["approachsettlement"], options);
	}


	_handleEvent(event) {
		this._addRow({ event, cells: [ event.message.Name, event.StarSystem ]});
	}
}


export default ApproachModule;
