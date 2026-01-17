import { DataTableModule } from "#DashboardModule";
import GalacticRegions from "#data/GalacticRegions.json" with { type: "json" };


export class CodexEntryModule extends DataTableModule {
	constructor(router, options) {
		super(router, ["codexentry"], options);
	}


	_handleEvent(event) {
		const row = this._makeRow(event);
		const message = event.message;

		row.append(
			this._makeCell(message.System),
			this._makeCell(trimPrefix(message.BodyName ?? "", message.System)), // strip system name from body name
			this._makeCell(message.SubCategory.replace(RX_SUB_CATEGORY, "$1").replaceAll("_", " ")), // reformat keys
			this._makeCell(message.Name.replace(RX_CODEX_NAME, "$1").replaceAll("_", " ")),
			this._makeCell(GalacticRegions[+(message.Region.replace(RX_REGION_NAME, "$1"))])); // look up region name from number

		this._addRow(row);
	}
}


const RX_SUB_CATEGORY = /^\$Codex_SubCategory_(.*);$/;
const RX_CODEX_NAME = /^\$Codex_Ent_(.*)_Name;$/;
const RX_REGION_NAME = /^\$Codex_RegionName_(.*);$/;

const trimPrefix = (str, prefix) => (str.startsWith(prefix) ? str.slice(prefix.length) : str).trim();


export default CodexEntryModule;
