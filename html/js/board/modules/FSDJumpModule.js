import { DataTableModule } from "#DashboardModule";


export class FSDJumpModule extends DataTableModule {
	constructor(router, container, options) {
		super(router, ["journal:fsdjump"], container, options);
	}


	_handleEvent(event) {
		const row = this.makeRow(event);
		row.append(this.makeCell(event.StarSystem));
		this.addRow(row);
	}
}


export default FSDJumpModule;
