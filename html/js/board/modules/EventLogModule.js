/**
 * @module EventLogModule
 * @description Dashboard module that displays a detailed log of every incoming
 * {@link EDDNEvent}, including age, uploader ID, event name, software,
 * system, galactic region from {@link RegionMap}, and game version.
 */

import { Config } from "#config.js";
import { DataTableModule } from "#DashboardModule";
import { stripPrefix, formatRelativeTime, hex2bg } from "#utils.js";


/**
 * Dashboard module that displays a detailed log of every incoming EDDN event,
 * including age, uploader ID bar, event name, software, system, region, and
 * game version.
 *
 * @extends DataTableModule
 */
export class EventLogModule extends DataTableModule {
	/**
	 * @param {MessageRouter} router - The {@link MessageRouter} to subscribe to.
	 * @param {Record<string, any>} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["*"], options);
	}


	/**
	 * Renders a row with relative time, coloured uploader-ID bar, event name,
	 * software details, star system, region, game version, and schema reference.
	 *
	 * @param {EDDNEvent} event - The incoming {@link EDDNEvent}.
	 * @returns {DataTableModule~CellDescriptor[] | (() => DataTableModule~CellDescriptor[])} cells - Array of cell descriptors (strings, DOM nodes, or factory functions), or a callback returning such an array.
	 */
	_getCells(event) {
		return () => [
			formatRelativeTime(event.age, Config._relTimeFormat),
			this.#idCell(event.header.uploaderID),
			event.eventName,
			event.header.softwareName,
			event.header.softwareVersion,
			event.StarSystem,
			event.Region.name,
			`${event.header.gameversion ?? ""}${event.header.gamebuild ? ` - ${event.header.gamebuild}` : ""}`,
			stripPrefix(event.$schemaRef, PREFIX_SCHEMAREF_EDDN)
		];
	}


	/**
	 * Creates a table cell displaying a colour-bar visualisation of the
	 * uploader's hex ID.
	 *
	 * @param {string} uploaderID - The uploader's hex identifier.
	 * @returns {HTMLTableCellElement}
	 */
	#idCell(uploaderID) {
		const idCell = this._makeCell(uploaderID);
		idCell.style.background = hex2bg(uploaderID);
		idCell.textContent = "\u00A0"; // &nbsp;
		return idCell;
	}
}


const PREFIX_SCHEMAREF_EDDN = "https://eddn.edcd.io/schemas/";


export default EventLogModule;
