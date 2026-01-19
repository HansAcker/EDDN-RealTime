import { DataTableModule } from "#DashboardModule";


export class FSDJumpModule extends DataTableModule {
	constructor(router, options) {
		super(router, ["journal:fsdjump"], options);
	}


	_handleEvent(event) {
		const row = this._makeRow(event);
		row.append(this._makeCell(event.StarSystem));
		this._addRow(row);
	}
}


export default FSDJumpModule;
