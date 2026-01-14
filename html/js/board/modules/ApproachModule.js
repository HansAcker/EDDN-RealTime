import { DataTableModule } from "#DashboardModule";


export class ApproachModule extends DataTableModule {
	constructor(router, container, options) {
		super(router, ["approachsettlement"], container, options);
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
