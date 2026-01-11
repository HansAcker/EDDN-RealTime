import { DataTableModule } from "#DashboardModule";
import { SortedStatsBox } from "#ui/statsbox.js";


export class EventStatsModule extends DataTableModule {
	#statsBox;

	constructor(router, container, options) {
		super(router, ["*"], container, options);
		this.#statsBox = new SortedStatsBox(container);
	}

	_handleEvent(event) {
		this.#statsBox.inc(event.eventName);
	}
}


export default EventStatsModule;
