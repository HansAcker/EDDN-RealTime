import { DataTableModule } from "#DashboardModule";
import GalacticRegions from "#ed/GalacticRegions.json" with { type: "json" };


const trimPrefix = (str, prefix) => (str.startsWith(prefix) ? str.slice(prefix.length) : str).trim();


export class CodexEntryModule extends DataTableModule {
	constructor(router, container, options) {
		super(router, ["codexentry"], container, options);
	}


	_handleEvent(event) {
		const row = this._makeRow(event);
		const message = event.message;

		row.append(
			this._makeCell(message.System),
			this._makeCell(trimPrefix(message.BodyName ?? "", message.System)), // strip system name from body name
			this._makeCell(message.SubCategory.replace(/^\$Codex_SubCategory_(.*);$/, "$1").replaceAll("_", " ")), // reformat keys
			this._makeCell(message.Name.replace(/^\$Codex_Ent_(.*)_Name;$/, "$1").replaceAll("_", " ")),
			this._makeCell(GalacticRegions[message.Region.replace(/^\$Codex_RegionName_(.*);$/, "$1")])); // look up region name from number

		this._addRow(row);
	}
}


export default CodexEntryModule;
