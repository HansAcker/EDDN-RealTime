import { Config } from "#config.js";
import { DataTableModule } from "#DashboardModule";


export class VisitsModule extends DataTableModule {
	constructor(router, options) {
		super(router, ["journal:fsdjump"], options);
	}


	_handleEvent(event) {
		const message = event.message;
		if (message.Population > 0 || message.SystemAllegiance) {
			const row = this._makeRow(event);
			const faction = message.SystemFaction ?? {};

			row.append(
				this._makeCell(event.StarSystem),
				this._makeCell(Config._numberFormat.format(message.Population ?? 0)),
				this._makeCell(message.SystemAllegiance),
				this._makeCell(faction.Name ?? ""),
				this._makeCell(faction.FactionState ?? "")
			);

			this._addRow(row);
		}

	}
}


export default VisitsModule;
