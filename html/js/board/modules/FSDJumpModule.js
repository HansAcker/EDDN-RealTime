import { DataTableModule } from "#DashboardModule";


export class FSDJumpModule extends DataTableModule {
	constructor(router, options) {
		super(router, ["journal:fsdjump"], options);
	}


	_handleEvent(event) {
		this._addRow({ event, cells: [ event.StarSystem ]});
	}
}


export default FSDJumpModule;
