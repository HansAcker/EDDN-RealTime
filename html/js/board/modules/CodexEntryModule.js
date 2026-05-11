/**
 * @module CodexEntryModule
 * @description Dashboard module that displays Codex discovery entries with decoded
 * category, name, and galactic region information from {@link RegionMap}.
 * Uses {@link GalacticRegions} data for name resolution.
 */

import { DataTableModule } from "#DashboardModule";
import { formatCodexKey, trimPrefix } from "#utils.js";
import GalacticRegions from "#data/GalacticRegions.json" with { type: "json" };


/**
 * Dashboard module that displays Codex discovery entries with decoded
 * category, name, and galactic region information.
 *
 * @extends DataTableModule
 */
export class CodexEntryModule extends DataTableModule {
	/**
	 * @param {MessageRouter} router - The {@link MessageRouter} to subscribe to.
	 * @param {Record<string, any>} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["codexentry"], options);
	}


	/**
	 * Renders a row showing the system, body, sub-category, name, and region.
	 *
	 * @param {EDDNEvent} event - The incoming {@link EDDNEvent}.
	 * @returns {DataTableModule~CellDescriptor[] | (() => DataTableModule~CellDescriptor[])} cells - Array of cell descriptors (strings, DOM nodes, or factory functions), or a callback returning such an array.
	 */
	_getCells(event) {
		const message = event.message;
		return () => [
			message.System,
			trimPrefix(message.BodyName ?? "", message.System), // strip system name from body name
			formatCodexKey(message.SubCategory, RX_SUB_CATEGORY), // reformat keys
			formatCodexKey(message.Name, RX_CODEX_NAME),
			GalacticRegions[+(RX_REGION_NAME.exec(message.Region)?.[1] ?? 0)]
		];
	}
}


const RX_SUB_CATEGORY = /^\$Codex_SubCategory_(.*);$/;
const RX_CODEX_NAME = /^\$Codex_Ent_(.*)_Name;$/;
const RX_REGION_NAME = /^\$Codex_RegionName_(.*);$/;


export default CodexEntryModule;
