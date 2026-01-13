import { DataTableModule } from "#DashboardModule";
import { RegionMap } from "#ed/RegionMap.js";


// 16 colors per nibble
// TODO: improve this "high-contrast" selection?
const hex_colors = {
	"0": "#F2F3F4", "1": "#222222", "2": "#F3C300", "3": "#875692",
	"4": "#F38400", "5": "#A1CAF1", "6": "#BE0032", "7": "#C2B280",
	"8": "#848482", "9": "#008856",
	// belts and braces - duplicate a-f, A-F
	"a": "#E68FAC", "b": "#0067A5", "c": "#F99379", "d": "#604E97",
	"e": "#DCD300", "f": "#B3446C",
	"A": "#E68FAC", "B": "#0067A5",	"C": "#F99379", "D": "#604E97",
	"E": "#DCD300", "F": "#B3446C"
};

// time rounding units in seconds
const time_units = [
	{ unit: 'year', seconds: 31536000 },
	{ unit: 'month', seconds: 2592000 },
	{ unit: 'day', seconds: 86400 },
	{ unit: 'hour', seconds: 3600 },
	{ unit: 'minute', seconds: 60 },
	{ unit: 'second', seconds: 1 }
];


/**
 * Formats a given date/time into a relative time string.
 * @param {Date | number | string} inputDate - Date object, timestamp (ms), or date string.
 * @returns {string} - Relative time string (e.g., "5 minutes ago", "in 2 hours").
 */
function formatRelativeTime(diffMs, rtf) {
    try {
        const diffSec = Math.round(-diffMs / 1000);

        for (const { unit, seconds } of time_units) {
            if (Math.abs(diffSec) >= seconds || unit === 'second') {
                const value = Math.round(diffSec / seconds);
                return rtf.format(value, unit);
            }
        }
    } catch (err) {
        console.error(err.message);
        return "Invalid date";
    }
}


export class EventLogModule extends DataTableModule {
	#timeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "narrow" });

	constructor(router, container, options) {
		super(router, ["*"], container, options);
	}


	_handleEvent(event) {
		const row = this._makeRow(event);

		const uploaderID = event.header.uploaderID;
		const idCell = this._makeCell(uploaderID);

/*
		// hex chars to braille patterns
		let idstr = "";
		for (let i = 0; i < uploaderID.length-1; i += 2) {
			idstr += String.fromCodePoint(parseInt(uploaderID.substring(i, i+2), 16) + 0x2800);
		}

		idCell.textContent = idstr;
*/

		// hex chars to colored blocks
		const stops = [];
		const len = uploaderID.length;
		const step = 100 / len;

		for (let i = 0; i < len; i++) {
			const color = hex_colors[uploaderID[i]] ?? "#000";
			// Hard stops for blocky look: color starts at i*step, ends at (i+1)*step
			stops.push(`${color} ${i * step}% ${(i + 1) * step}%`);
//			stops.push(`${color} ${(i + 1) * step}%`);
		}

		const bar = document.createElement("span");
		bar.style = `
			display: inline-block;
			height: 1em;
			width: 100%;
			/* min-width: 100px; */
			background: linear-gradient(to right, ${stops.join(",")});
		`;

		// bar.textContent = idCell.textContent;
		idCell.replaceChildren(bar);


		row.append(
			this._makeCell(formatRelativeTime(event.age, this.#timeFormat)),
			idCell,
			this._makeCell(event.eventName),
			this._makeCell(event.header.softwareName),
			this._makeCell(event.header.softwareVersion),
			this._makeCell(event.StarSystem),
			this._makeCell(event.StarPos ? RegionMap.findRegion(...event.StarPos).name ?? "" : ""),
			this._makeCell(`${event.header.gameversion}${event.header.gamebuild ? ` - ${event.header.gamebuild}` : ""}`),
			this._makeCell(event.$schemaRef.replace(/^https:\/\/eddn\.edcd\.io\/schemas\//, ""))
		);
		this._addRow(row);

	}
}


export default EventLogModule;
