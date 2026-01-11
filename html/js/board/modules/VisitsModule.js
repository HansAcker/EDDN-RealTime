import { DataTableModule } from "#DashboardModule";


export class VisitsModule extends DataTableModule {
	static #numFormat = new Intl.NumberFormat("en", { notation: "standard", useGrouping: "always" }).format;


	constructor(router, container, options) {
		super(router, ["journal:fsdjump"], container, options);
	}


	_handleEvent(event) {
		const message = event.message;
		if (message.Population > 0 || message.SystemAllegiance) {
			const row = this.makeRow(event);
			const faction = message.SystemFaction ?? {};

			row.append(
				this.makeCell(event.StarSystem),
				this.makeCell(VisitsModule.#numFormat(message.Population ?? 0)),
				this.makeCell(message.SystemAllegiance),
				this.makeCell(faction.Name ?? ""),
				this.makeCell(faction.FactionState ?? "")
			);

			this.addRow(row);
		}

	}
}


export default VisitsModule;
