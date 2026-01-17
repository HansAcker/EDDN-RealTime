import { DataTableModule } from "#DashboardModule";


export class ApproachModule extends DataTableModule {
	constructor(router, options) {
		super(router, ["approachsettlement"], options);
	}


	_handleEvent(event) {
		const row = this._makeRow(event);
		row.append(
			this._makeCell(event.message.Name),
			this._makeCell(event.StarSystem)
		);
		this._addRow(row);
	}
}


export default ApproachModule;
