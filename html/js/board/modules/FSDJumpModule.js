import { DashboardModule} from "DashboardModule";


export class FSDJumpModule extends DashboardModule {
	constructor(eddnClient, container, infobox) {
		super(eddnClient, ["journal:fsdjump"], container, infobox);
	}

	_handleEvent(event) {
		const row = this.makeRow(event);
		row.append(this.makeCell(event.message.StarSystem));
		this.addRow(row);
	}
}


export default FSDJumpModule;
