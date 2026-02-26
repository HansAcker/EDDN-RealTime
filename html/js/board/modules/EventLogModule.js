/**
 * @module EventLogModule
 * @description Dashboard module that displays a detailed log of every incoming
 * {@link EDDNEvent}, including age, uploader ID, event name, software,
 * system, galactic region from {@link RegionMap}, and game version.
 */

import { Config } from "#config.js";
import { DataTableModule } from "#DashboardModule";


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
	 */
	_handleEvent(event) {
		this._addRow({ event, cells: () => [
			formatRelativeTime(event.age),
			this.#idCell(event.header.uploaderID),
			event.eventName,
			event.header.softwareName,
			event.header.softwareVersion,
			event.StarSystem,
			event.Region.name,
			`${event.header.gameversion ?? ""}${event.header.gamebuild ? ` - ${event.header.gamebuild}` : ""}`,
			event.$schemaRef.startsWith(PREFIX_SCHEMAREF_EDDN) ? event.$schemaRef.slice(PREFIX_SCHEMAREF_EDDN.length) : event.$schemaRef
		]});
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


// time rounding units in seconds
const time_units = Object.freeze([
	Object.freeze({ unit: "year", seconds: 31536000 }),
	Object.freeze({ unit: "month", seconds: 2592000 }),
	Object.freeze({ unit: "day", seconds: 86400 }),
	Object.freeze({ unit: "hour", seconds: 3600 }),
	Object.freeze({ unit: "minute", seconds: 60 })
]);

/**
 * Formats a number of ms into a relative time string.
 * @param {number} diffMs - Relative time in ms (positive: past, negative: future)
 * @returns {string|undefined} - Relative time string (e.g., "5 minutes ago", "in 2 hours") or undefined if diffMs is NaN.
 */
function formatRelativeTime(diffMs) {
	if (typeof diffMs !== "number") {
		return undefined;
	}

	const diffSec = Math.round(-diffMs / 1000);
	const diffAbs = Math.abs(diffSec);

	if (diffAbs < 60) {
		return Config._relTimeFormat.format(diffSec, "second");
	}

	// TODO: reverse the lookup? "minutes ago" happens more often than "years ago"
	for (const { unit, seconds } of time_units) {
		if (diffAbs >= seconds) {
			return Config._relTimeFormat.format(Math.round(diffSec / seconds), unit);
		}
	}

	// NaN ends up here
	return undefined;
}


// 16 colors per nibble
// TODO: improve this "high-contrast" selection?
const hex_colors = Object.freeze([
	"#0067A5", "#008856", "#222222", "#604E97",
	"#848482", "#875692", "#A1CAF1", "#B3446C",
	"#BE0032", "#C2B280", "#DCD300", "#E68FAC",
	"#F2F3F4", "#F38400", "#F3C300", "#F99379"
]);

/**
 * Converts a hex identifier string into a linear-gradient
 * where each hex character maps to a colour.
 *
 * @param {string} id - The hex identifier string.
 * @returns {string}
 */
function hex2bg(id) {
	const len = id.length;
	const step = 100 / len;
	const stops = [];

	// hex chars to colored blocks
	for (let i = 0; i < len; i++) {
		const c = id.charCodeAt(i); // should be in "0-9" (0x30-0x39), "A-F" (0x41-0x46), "a-f" (0x61-0x66)
		const color = hex_colors[(c & 0x0f) + ((c >> 6) ? 9 : 0)] ?? "#000"; // map character codes "0-9", "A-F", "a-f" to 0-15
		// hard stops for blocky look: color starts at i*step, ends at (i+1)*step
		stops.push(`${color} ${i * step}% ${(i + 1) * step}%`);
	}

	return `linear-gradient(to right, ${stops.join(",")})`;
}


export default EventLogModule;
