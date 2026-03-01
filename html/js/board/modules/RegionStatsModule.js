import { DataTableModule } from "#DashboardModule";
import { SortedStatsBox } from "#ui/statsbox.js";
import GalacticRegions from "#data/GalacticRegions.json" with { type: "json" };


/**
 * Dashboard module that counts and displays events grouped by event region,
 * sorted by frequency.
 *
 * @extends DataTableModule
 */
export class RegionStatsModule extends DataTableModule {
	_statsBox;
	_chart;

	/**
	 * @param {MessageRouter} router - The {@link MessageRouter} to subscribe to.
	 * @param {object} [options] - Configuration forwarded to {@link DataTableModule}.
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
		const values = {};

		// skip index 0 (null)
		for (let i = 1; i < GalacticRegions.length; i++) {
			values[GalacticRegions[i]] = 0;
		}

		this._statsBox = new SortedStatsBox(this._container, { values });
		return table;
	}

	/**
	 * Increments the counter for the event's region name.
	 *
	 * @param {EDDNEvent} event - The incoming EDDN event.
	 */
	_handleEvent(event) {
		if (event.StarPos) {
			this._statsBox.inc(event.Region.name);
		}
	}
}


export default RegionStatsModule;
