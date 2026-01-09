import { DashboardModule} from "DashboardModule";
import { RegionMap } from "ed/RegionMap.js";

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


export class EventLogModule extends DashboardModule {
	#timeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: "narrow" });

	constructor(eddnClient, container, infobox, options) {
		super(eddnClient, ["*"], container, infobox, options);
	}

	_handleEvent(event) {
		const message = event.message;
		const row = this.makeRow(event);

		let idstr = "";
		const uploaderID = event.header.uploaderID;
		for (let i = 0; i < uploaderID.length-1; i += 2) {
			idstr += String.fromCodePoint(parseInt(uploaderID.substring(i, i+2), 16) + 0x2800); // hex chars to braille patterns
		}

		row.append(
			this.makeCell(formatRelativeTime(event.age, this.#timeFormat)),
			this.makeCell(idstr),
			this.makeCell(message.event ?? event.eventType),
			this.makeCell(event.header.softwareName),
			this.makeCell(event.header.softwareVersion),
			this.makeCell(message.StarSystem ?? message.systemName ?? message.Route?.[0]?.StarSystem ?? ""),
			this.makeCell(RegionMap.findRegion(...(message.StarPos ?? message.Route?.[0]?.StarPos ?? [])).name ?? ""),
			this.makeCell(`${event.header.gameversion}${event.header.gamebuild ? ` - ${event.header.gamebuild}` : ""}`),
			this.makeCell(event.$schemaRef.replace(/^https:\/\/eddn.edcd.io\/schemas\//, ""))
		);
		this.addRow(row);

	}
}


export default EventLogModule;
