import { DataTableModule } from "#DashboardModule";
import { Config } from "#config.js";


export class VisitsModule extends DataTableModule {
	constructor(router, container, options) {
		super(router, ["journal:fsdjump"], container, options);
	}


	_handleEvent(event) {
		const message = event.message;
		if (message.Population > 0 || message.SystemAllegiance) {
			const row = this._makeRow(event);
			const faction = message.SystemFaction ?? {};

			row.append(
				this._makeCell(event.StarSystem),
				this._makeCell(Config.numberFormat.format(message.Population ?? 0)),
				this._makeCell(message.SystemAllegiance),
				this._makeCell(faction.Name ?? ""),
				this._makeCell(faction.FactionState ?? "")
			);

			this._addRow(row);
		}

	}
}


export default VisitsModule;
