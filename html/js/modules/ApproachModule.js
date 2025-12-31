import DashboardModule from "DashboardModule";


export class ApproachModule extends DashboardModule {
	constructor(eddnClient, container, infobox) {
		super(eddnClient, ["approachsettlement"], container, infobox);
	}

	_handleEvent(event) {
		const row = this.makeRow(event);
		const message = event.message;
		row.append(this.makeCell(message.Name), this.makeCell(message.StarSystem));
		this.addRow(row);
	}
}


export default ApproachModule;
