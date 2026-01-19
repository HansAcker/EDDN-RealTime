import { DataTableModule } from "#DashboardModule";
import { StatsBox } from "#ui/statsbox.js";


export class SoftwareStatsModule extends DataTableModule {
	// TODO: don't declare it here because of the way _setupContainer() is called by super constructor
	//_statsBox;

	constructor(router, options) {
		super(router, ["*"], options);
	}

	_setupContainer() {
		const table = super._setupContainer();
		this._statsBox = new StatsBox(this._container);
		return table;
	}

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
