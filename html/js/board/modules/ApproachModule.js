import { DataTableModule } from "#DashboardModule";


export class ApproachModule extends DataTableModule {
	constructor(router, container, options) {
		super(router, ["approachsettlement"], container, options);
	}


	_handleEvent(event) {
		const row = this.makeRow(event);
		const message = event.message;
		row.append(this.makeCell(message.Name), this.makeCell(event.StarSystem));
		this.addRow(row);
	}
}


export default ApproachModule;
