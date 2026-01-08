import DashboardModule from "DashboardModule";
import GalacticRegions from "ed/GalacticRegions.json" with { type: "json" };


const trimPrefix = (str, prefix) => (str.startsWith(prefix) ? str.slice(prefix.length) : str).trim();

export class CodexEntryModule extends DashboardModule {
	constructor(eddnClient, container, infobox) {
		super(eddnClient, ["codexentry"], container, infobox);
	}

	_handleEvent(event) {
		const row = this.makeRow(event);
		const message = event.message;

		row.append(this.makeCell(message.System),
			this.makeCell(trimPrefix(message.BodyName ?? "", message.System)), // strip system name from body name
			this.makeCell(message.SubCategory.replace(/^\$Codex_SubCategory_(.*);$/, "$1").replaceAll("_", " ")), // reformat keys
			this.makeCell(message.Name.replace(/^\$Codex_Ent_(.*)_Name;$/, "$1").replaceAll("_", " ")),
			this.makeCell(GalacticRegions[message.Region.replace(/^\$Codex_RegionName_(.*);$/, "$1")])); // look up region name from number

		this.addRow(row);
	}
}


export default CodexEntryModule;
