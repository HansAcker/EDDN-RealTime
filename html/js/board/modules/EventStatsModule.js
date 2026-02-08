/**
 * @module EventStatsModule
 * @description Dashboard module that counts and displays events grouped by event
 * name, sorted by frequency. Uses {@link SortedStatsBox} for
 * rendering sorted statistics.
 */

import { DataTableModule } from "#DashboardModule";
import { SortedStatsBox } from "#ui/statsbox.js";


/**
 * Dashboard module that counts and displays events grouped by event name,
 * sorted by frequency.
 *
 * @extends DataTableModule
 */
export class EventStatsModule extends DataTableModule {
	_statsBox;

	/**
	 * @param {MessageRouter} router - The {@link MessageRouter} to subscribe to.
	 * @param {Object} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["*"], options);
	}

	/**
	 * Initialises a {@link SortedStatsBox} inside the module's table body.
	 *
	 * @returns {DocumentFragment|null}
	 */
	_setupContainer() {
		const table = super._setupContainer();
		this._statsBox = new SortedStatsBox(this._container);
		return table;
	}

	/**
	 * Increments the counter for the event's name.
	 *
	 * @param {EDDNEvent} event - The incoming {@link EDDNEvent}.
	 */
	_handleEvent(event) {
		this._statsBox.inc(event.eventName);
	}
}


export default EventStatsModule;
