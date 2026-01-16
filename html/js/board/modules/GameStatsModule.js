import { DataTableModule } from "#DashboardModule";
import { StatsBox } from "#ui/statsbox.js";


export class GameStatsModule extends DataTableModule {
	// TODO: don't declare it here because of the way _setupContainer() is called by super constructor
	//_statsBox;

	constructor(router, container, options) {
		super(router, ["*"], container, options);
	}

	_setupContainer(container) {
		const tbody = super._setupContainer(container);
		this._statsBox = new StatsBox(tbody, { values: {
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
		return tbody;
	}

	_handleEvent(event) {
		this._statsBox.inc("Total");
		this._statsBox.inc(event.gameType);

		if (event.isTaxi) {
			this._statsBox.inc("Taxi");
		}

		if (event.isMulticrew) {
			this._statsBox.inc("Multicrew");
		}

		if (event.age > 3600 * 1000) {
			this._statsBox.inc("Old");
		} else if (event.age < 180 * -1000) {
			this._statsBox.inc("New");
		}

//		this._statsBox.set("Last timestamp", event.message.timestamp);
	}
}


export default GameStatsModule;
