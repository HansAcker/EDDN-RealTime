/**
 * @module board/modules/GameStatsModule
 * @description Dashboard module that displays aggregate statistics about incoming
 * {@link EDDNEvent} events, broken down by game type (Odyssey/Horizons),
 * taxi/multicrew status, and message age. Uses {@link StatsBox}.
 */

import { Config } from "#config.js";
import { DataTableModule } from "#DashboardModule";
import { StatsBox } from "#ui/statsbox.js";


/**
 * Dashboard module that displays aggregate statistics about incoming events,
 * broken down by game type, taxi/multicrew status, and message age.
 *
 * @extends DataTableModule
 */
export class GameStatsModule extends DataTableModule {
	_statsBox;

	/**
	 * @param {MessageRouter} router - The {@link MessageRouter} to subscribe to.
	 * @param {Object} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["*"], options);
	}

	/**
	 * Initialises the {@link StatsBox} with pre-defined category labels.
	 *
	 * @returns {DocumentFragment|null}
	 */
	_setupContainer() {
		const table = super._setupContainer();
		this._statsBox = new StatsBox(this._container, { values: {
			"Total": 0,
			"Odyssey": 0,
			"Horizons": 0,
			"Base": 0,
			"Legacy": 0,
			"Unknown": 0,
			"Taxi": 0,
			"Multicrew": 0,
			"Old": 0,
			"New": 0,
//			"Last timestamp": "",
//			"Max jump range": ""
		}});
		return table;
	}

	/**
	 * Increments the relevant counters for the event's game type, taxi/multicrew
	 * flags, and message age category.
	 *
	 * @param {EDDNEvent} event - The incoming {@link EDDNEvent}.
	 */
	_handleEvent(event) {
		this._statsBox.inc("Total");
		this._statsBox.inc(event.gameType);

		if (event.isTaxi) {
			this._statsBox.inc("Taxi");
		}

		if (event.isMulticrew) {
			this._statsBox.inc("Multicrew");
		}

		if (event.age > Config.oldAge) {
			this._statsBox.inc("Old");
		} else if (event.age < Config.newAge) {
			this._statsBox.inc("New");
		}

//		this._statsBox.set("Last timestamp", event.message.timestamp);
	}
}


export default GameStatsModule;
