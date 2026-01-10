import DashboardModule from "DashboardModule";


export class ApproachModule extends DashboardModule {
	constructor(router, container, infobox) {
		super(router, ["approachsettlement"], container, infobox);
	}

	_handleEvent(event) {
		const row = this.makeRow(event);
		const message = event.message;
		row.append(this.makeCell(message.Name), this.makeCell(event.StarSystem));
		this.addRow(row);
	}
}


export default ApproachModule;
