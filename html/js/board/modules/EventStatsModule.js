import { DataTableModule } from "#DashboardModule";
import { SortedStatsBox } from "#ui/statsbox.js";


export class EventStatsModule extends DataTableModule {
	_statsBox;

	constructor(router, options) {
		super(router, ["*"], options);
	}

	_setupContainer() {
		const table = super._setupContainer();
		this._statsBox = new SortedStatsBox(this._container);
		return table;
	}

	_handleEvent(event) {
		this._statsBox.inc(event.eventName);
	}
}


export default EventStatsModule;
