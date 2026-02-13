/**
 * @module NavRouteModule
 * @description Dashboard module that displays navigation route events from Elite
 * Dangerous, including start and end systems, jump count, total distance, and
 * longest single jump with highlighting for long-range jumps (≥ 200 ly).
 */

import { Config } from "#config.js";
import { DataTableModule } from "#DashboardModule";


/**
 * Dashboard module that displays navigation route events, including start
 * and end systems, jump count, total distance, and longest single jump.
 *
 * @extends DataTableModule
 */
export class NavRouteModule extends DataTableModule {
	/**
	 * @param {MessageRouter} router - The {@link MessageRouter} to subscribe to.
	 * @param {Record<string, any>} [options] - Configuration forwarded to {@link DataTableModule}.
	 */
	constructor(router, options) {
		super(router, ["navroute"], options);
	}


	/**
	 * Renders a row showing start/end systems, jump count, total distance,
	 * route distance, and longest jump (highlighted for jumps ≥ 200 ly).
	 *
	 * @param {EDDNEvent} event - The incoming {@link EDDNEvent}.
	 */
	_handleEvent(event) {
		const route = event.message.Route ?? [];

		if (route.length < 2) {
			// it happens.
			//console.log("Short NavRoute:", event.data);
			return;
		}

		let dist = 0;
		let longest = 0;

		const cells = [];

		cells.push(
			route[0].StarSystem,
			route[route.length-1].StarSystem,
			`${route.length-1}j`
		);

		if (route.length === 2) {
			// single-jump route

			dist = longest = distance3(route[0].StarPos, route[1].StarPos);
			cells.push(`${dist.toFixed(2)}ly`, "");
		} else {
			// sum jump distances

			let cur;
			for (const wp of route) {
				if (!cur) {
					// start system
					cur = wp.StarPos;
					// distance to destination system
					cells.push(`${distance3(cur, route[route.length-1].StarPos).toFixed(2)}ly`);
					continue;
				}

				const hop = wp.StarPos;
				const range = distance3(cur, hop);

				if (longest < range) {
					longest = range;
				}

				dist += range;
				cur = hop;
			}

			cells.push(`${dist.toFixed(2)}ly`);
		}

/*
		// update the record
		if (maxrange < longest) {
			maxrange = longest;
			gameStats.set("Max jump range", `${longest.toFixed(2)}ly`);
		}
*/

		if (longest < Config.longJump) {
			cells.push(`${longest.toFixed(2)}ly`);
		} else {
			// custom node with extra CSS class
			const cell = this._makeCell(`${longest.toFixed(2)}ly`);
			cell.classList.add("longjump");
			cells.push(cell);
		}

		this._addRow({ event, cells });
	}
}


// const distanceN = (v0, v1) => Math.hypot(...v0.map((v, i) => v - v1[i]));
const distance3 = (v0, v1) => Math.hypot(v0[0] - v1[0], v0[1] - v1[1], v0[2] - v1[2]); // subtract vectors, return length


export default NavRouteModule;
