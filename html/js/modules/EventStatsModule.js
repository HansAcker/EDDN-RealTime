import DashboardModule from "DashboardModule";
import { SortedStatsBox } from "ui/statsbox.js";


export class EventStatsModule extends DashboardModule {
	#statsBox;

	constructor(eddnClient, container, infobox) {
		super(eddnClient, ["eddn:message"], container, infobox);
		this.#statsBox = new SortedStatsBox(container);
	}

	_handleEvent(event) {
		this.#statsBox.inc(event.eventType.replace(/^journal:/, ""));
	}
}


export default EventStatsModule;
