/**
 * @module board/modules/SoftwareStatsModule
 * @description Dashboard module that counts and displays events grouped by uploader
 * software name and version. Uses {@link StatsBox} to track
 * different EDDN client applications.
 */

import { DataTableModule } from "#DashboardModule";
import { StatsBox } from "#ui/statsbox.js";


/**
 * Dashboard module that counts and displays events grouped by uploader
 * software name and version.
 *
 * @extends {@link DataTableModule}
 */
export class SoftwareStatsModule extends DataTableModule {
	_statsBox;

	/**
	 * @param {@link MessageRouter} router - The message router to subscribe to.
	 * @param {Object} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["*"], options);
	}

	/**
	 * Initialises the {@link StatsBox} inside the module's table body.
	 *
	 * @returns {DocumentFragment|null}
	 */
	_setupContainer() {
		const table = super._setupContainer();
		this._statsBox = new StatsBox(this._container);
		return table;
	}

	/**
	 * Increments the counter for the event's software name and version,
	 * re-sorting the table when a new entry is added.
	 *
	 * @param {@link EDDNEvent} event - The incoming EDDN event.
	 */
	_handleEvent(event) {
		// TODO: this should go into SortedStatsBox and insert new tr in the right position

		// TODO: group totals by softwareName, collapse individual versions
		const header = event.header;
		const tag = `${header.softwareName} ${header.softwareVersion}`;

		// sort and replace the whole table if its element count changed
		const needsort = !this._statsBox.has(tag);
		this._statsBox.inc(tag);

		if (needsort) {
			const tbody = this._container;
			tbody.replaceChildren(...[...tbody.children].sort((a, b) => b.children[0].textContent.localeCompare(a.children[0].textContent)));
		}
	}
}


export default SoftwareStatsModule;
