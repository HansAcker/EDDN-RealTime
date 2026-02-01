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
			this._makeCell(formatCodexKey(message.SubCategory, RX_SUB_CATEGORY)), // reformat keys
			this._makeCell(formatCodexKey(message.Name, RX_CODEX_NAME)),
			this._makeCell(GalacticRegions[+(RX_REGION_NAME.exec(message.Region)?.[1] ?? 0)])
		);

		this._addRow(row);
	}
}


const RX_SUB_CATEGORY = /^\$Codex_SubCategory_(.*);$/;
const RX_CODEX_NAME = /^\$Codex_Ent_(.*)_Name;$/;
const RX_REGION_NAME = /^\$Codex_RegionName_(.*);$/;

const formatCodexKey = (str, regex) => regex.exec(str)?.[1]?.replaceAll("_", " ") ?? str;

const trimPrefix = (str, prefix) => (str.startsWith(prefix) ? str.slice(prefix.length) : str).trim();


export default CodexEntryModule;
