import { Config } from "#config.js";
import { DataTableModule } from "#DashboardModule";


export class VisitsModule extends DataTableModule {
	constructor(router, options) {
		super(router, ["journal:fsdjump"], options);
	}


	_handleEvent(event) {
		const message = event.message;
		if (message.Population > 0 || message.SystemAllegiance) {
			const faction = message.SystemFaction ?? {};

			this._addRow({ event, cells: [
				event.StarSystem,
				Config._numberFormat.format(message.Population ?? 0),
				message.SystemAllegiance,
				faction.Name,
				faction.FactionState
			]});
		}
	}
}


export default VisitsModule;
