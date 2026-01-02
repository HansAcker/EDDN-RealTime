import DashboardModule from "DashboardModule";
import { SortedStatsBox } from "ui/statsbox.js";


export class EventStatsModule extends DashboardModule {
	#statsBox;

	constructor(eddnClient, container, infobox) {
		super(eddnClient, ["*"], container, infobox);
		this.#statsBox = new SortedStatsBox(container);
	}

	_handleEvent(event) {
		this.#statsBox.inc(event.message.event ?? event.eventType);
	}
}


export default EventStatsModule;
