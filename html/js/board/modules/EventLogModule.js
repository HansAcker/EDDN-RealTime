import { DataTableModule } from "#DashboardModule";
import { RegionMap } from "#ed/RegionMap.js";


/**
 * Formats a given date/time into a relative time string.
 * @param {Date | number | string} inputDate - Date object, timestamp (ms), or date string.
 * @returns {string} - Relative time string (e.g., "5 minutes ago", "in 2 hours").
 */
function formatRelativeTime(diffMs, rtf) {
    try {
        const diffSec = Math.round(-diffMs / 1000);

        // Define time units in seconds
        const units = [
            { unit: 'year', seconds: 31536000 },
            { unit: 'month', seconds: 2592000 },
            { unit: 'day', seconds: 86400 },
            { unit: 'hour', seconds: 3600 },
            { unit: 'minute', seconds: 60 },
            { unit: 'second', seconds: 1 }
        ];

        for (const { unit, seconds } of units) {
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
		const row = this.makeRow(event);

		const uploaderID = event.header.uploaderID;
		const idCell = this.makeCell(uploaderID);

/*
		// hex chars to braille patterns
		let idstr = "";
		for (let i = 0; i < uploaderID.length-1; i += 2) {
			idstr += String.fromCodePoint(parseInt(uploaderID.substring(i, i+2), 16) + 0x2800);
		}

		idCell.textContent = idstr;
*/

		// hex chars to colored blocks
		const colors = [
			"#F2F3F4", "#222222", "#F3C300", "#875692",
			"#F38400", "#A1CAF1", "#BE0032", "#C2B280",
			"#848482", "#008856", "#E68FAC", "#0067A5",
			"#F99379", "#604E97", "#DCD300", "#B3446C"
		];

		const stops = [];
		const len = uploaderID.length;
		const step = 100 / len;

		for (let i = 0; i < len; i++) {
			const color = colors[parseInt(uploaderID[i], 16)];
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
			this.makeCell(formatRelativeTime(event.age, this.#timeFormat)),
			idCell,
			this.makeCell(event.eventName),
			this.makeCell(event.header.softwareName),
			this.makeCell(event.header.softwareVersion),
			this.makeCell(event.StarSystem),
			this.makeCell(event.StarPos ? RegionMap.findRegion(...event.StarPos).name ?? "" : ""),
			this.makeCell(`${event.header.gameversion}${event.header.gamebuild ? ` - ${event.header.gamebuild}` : ""}`),
			this.makeCell(event.$schemaRef.replace(/^https:\/\/eddn.edcd.io\/schemas\//, ""))
		);
		this.addRow(row);

	}
}


export default EventLogModule;
