/**
 * @module board/modules/CodexEntryModule
 * @description Dashboard module that displays Codex discovery entries with decoded
 * category, name, and galactic region information from {@link RegionMap}.
 * Uses {@link GalacticRegions} data for name resolution.
 */

import { DataTableModule } from "#DashboardModule";
import GalacticRegions from "#data/GalacticRegions.json" with { type: "json" };


/**
 * Dashboard module that displays Codex discovery entries with decoded
 * category, name, and galactic region information.
 *
 * @extends {@link DataTableModule}
 */
export class CodexEntryModule extends DataTableModule {
	/**
	 * @param {@link MessageRouter} router - The message router to subscribe to.
	 * @param {Object} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["codexentry"], options);
	}


	/**
	 * Renders a row showing the system, body, sub-category, name, and region.
	 *
	 * @param {@link EDDNEvent} event - The incoming EDDN event.
	 */
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

/**
 * Extracts a human-readable label from a Codex key string using the given
 * regex, replacing underscores with spaces.
 *
 * @param {string} str - The raw Codex key string.
 * @param {RegExp} regex - Pattern whose first capture group contains the label.
 * @returns {string} The formatted label, or the original string if no match.
 */
const formatCodexKey = (str, regex) => regex.exec(str)?.[1]?.replaceAll("_", " ") ?? str;

/**
 * Removes a prefix from a string and trims whitespace.
 *
 * @param {string} str - The string to process.
 * @param {string} prefix - The prefix to remove.
 * @returns {string}
 */
const trimPrefix = (str, prefix) => (str.startsWith(prefix) ? str.slice(prefix.length) : str).trim();


export default CodexEntryModule;
