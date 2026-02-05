import { DataTableModule } from "#DashboardModule";
import GalacticRegions from "#data/GalacticRegions.json" with { type: "json" };


export class CodexEntryModule extends DataTableModule {
	constructor(router, options) {
		super(router, ["codexentry"], options);
	}


	_handleEvent(event) {
		const message = event.message;
		this._addRow({ event, cells: [
			message.System,
			trimPrefix(message.BodyName ?? "", message.System), // strip system name from body name
			formatCodexKey(message.SubCategory, RX_SUB_CATEGORY), // reformat keys
			formatCodexKey(message.Name, RX_CODEX_NAME),
			GalacticRegions[+(RX_REGION_NAME.exec(message.Region)?.[1] ?? 0)]
		]});
	}
}


const RX_SUB_CATEGORY = /^\$Codex_SubCategory_(.*);$/;
const RX_CODEX_NAME = /^\$Codex_Ent_(.*)_Name;$/;
const RX_REGION_NAME = /^\$Codex_RegionName_(.*);$/;

const formatCodexKey = (str, regex) => regex.exec(str)?.[1]?.replaceAll("_", " ") ?? str;

const trimPrefix = (str, prefix) => (str.startsWith(prefix) ? str.slice(prefix.length) : str).trim();


export default CodexEntryModule;
