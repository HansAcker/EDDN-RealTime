import { DataTableModule } from "#DashboardModule";
import { SortedStatsBox } from "#ui/statsbox.js";


export class EventStatsModule extends DataTableModule {
	// TODO: don't declare it here because of the way _setupContainer() is called by super constructor
	//_statsBox;

	constructor(router, container, options) {
		super(router, ["*"], container, options);
	}

	_setupContainer(container) {
		const tbody = super._setupContainer(container);
		this._statsBox = new SortedStatsBox(tbody);
		return tbody;
	}

	_handleEvent(event) {
		this._statsBox.inc(event.eventName);
	}
}


export default EventStatsModule;
