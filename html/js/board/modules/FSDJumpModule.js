import { DashboardModule} from "DashboardModule";


export class FSDJumpModule extends DashboardModule {
	constructor(router, container, infobox) {
		super(router, ["journal:fsdjump"], container, infobox);
	}

	_handleEvent(event) {
		const row = this.makeRow(event);
		row.append(this.makeCell(event.StarSystem));
		this.addRow(row);
	}
}


export default FSDJumpModule;
