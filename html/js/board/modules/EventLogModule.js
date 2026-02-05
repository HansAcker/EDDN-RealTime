import { Config } from "#config.js";
import { DataTableModule } from "#DashboardModule";


export class EventLogModule extends DataTableModule {
	constructor(router, options) {
		super(router, ["*"], options);
	}


	_handleEvent(event) {
		const row = this._makeRow(event);

		const uploaderID = event.header.uploaderID;
		const idCell = this._makeCell(uploaderID);
		idCell.classList.add("dashboard__table--idcell");
		idCell.replaceChildren(hex2bar(uploaderID));

		row.append(
			this._makeCell(formatRelativeTime(event.age)),
			idCell,
			this._makeCell(event.eventName),
			this._makeCell(event.header.softwareName),
			this._makeCell(event.header.softwareVersion),
			this._makeCell(event.StarSystem),
			this._makeCell(event.Region.name ?? ""),
			this._makeCell(`${event.header.gameversion ?? ""}${event.header.gamebuild ? ` - ${event.header.gamebuild}` : ""}`),
			this._makeCell(event.$schemaRef.replace(RX_SCHEMAREF_EDDN, ""))
		);

		this._addRow(row);
	}
}


const RX_SCHEMAREF_EDDN = /^https:\/\/eddn\.edcd\.io\/schemas\//;


// time rounding units in seconds
const time_units = Object.freeze([
	{ unit: 'year', seconds: 31536000 },
	{ unit: 'month', seconds: 2592000 },
	{ unit: 'day', seconds: 86400 },
	{ unit: 'hour', seconds: 3600 },
	{ unit: 'minute', seconds: 60 }
]);

/**
 * Formats a number of ms into a relative time string.
 * @param {number} diffMs - Relative time in ms (positive: past, negative: future)
 * @returns {string} - Relative time string (e.g., "5 minutes ago", "in 2 hours").
 */
function formatRelativeTime(diffMs) {
	try {
		const diffSec = Math.round(-diffMs / 1000);
		const diffAbs = Math.abs(diffSec);

		if (diffAbs < 60) {
			return Config._relTimeFormat.format(diffSec, "second");
		}

		// TODO: reverse the lookup, "minutes ago" happens more often than "years ago"
		for (const { unit, seconds } of time_units) {
			if (diffAbs >= seconds || unit === "minute") {
				const value = Math.round(diffSec / seconds);
				return Config._relTimeFormat.format(value, unit);
			}
		}
	} catch (err) {
		console.error(err.message);
		return "Invalid date";
	}
}


// 16 colors per nibble
// TODO: improve this "high-contrast" selection?
const hex_colors = Object.freeze({
	"0": "#F2F3F4", "1": "#222222", "2": "#F3C300", "3": "#875692",
	"4": "#F38400", "5": "#A1CAF1", "6": "#BE0032", "7": "#C2B280",
	"8": "#848482", "9": "#008856",
	// belts and braces - duplicate a-f, A-F
	"a": "#E68FAC", "b": "#0067A5", "c": "#F99379", "d": "#604E97",
	"e": "#DCD300", "f": "#B3446C",
	"A": "#E68FAC", "B": "#0067A5",	"C": "#F99379", "D": "#604E97",
	"E": "#DCD300", "F": "#B3446C"
});

function hex2bar(id) {
	// hex chars to colored blocks
	const len = id.length;
	const step = 100 / len;
	const stops = [];

	for (let i = 0; i < len; i++) {
		const color = hex_colors[id[i]] ?? "#000";
		// hard stops for blocky look: color starts at i*step, ends at (i+1)*step
		stops.push(`${color} ${i * step}% ${(i + 1) * step}%`);
	}

	const bar = document.createElement("span");
	bar.style.background = `linear-gradient(to right, ${stops.join(",")})`;
	bar.textContent = String.fromCharCode(160); // &nbsp;

	return bar;
}


/*
function hex2braille(id) {
	// hex chars to braille patterns
	let idstr = "";
	for (let i = 0; i < id.length-1; i += 2) {
		idstr += String.fromCodePoint(parseInt(id.substring(i, i+2), 16) + 0x2800);
	}

	return idstr;
}
*/


export default EventLogModule;
