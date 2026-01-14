import { DataTableModule } from "#DashboardModule";


export class NavRouteModule extends DataTableModule {
	constructor(router, container, options) {
		super(router, ["navroute"], container, options);
	}


	_handleEvent(event) {
		const route = event.message.Route ?? [];

		if (route.length < 2) {
			// it happens.
			//console.log("Short NavRoute:", event.data);
			return;
		}

		let dist = 0;
		let longest = 0;

		const row = this._makeRow(event);

		row.append(
			this._makeCell(route[0].StarSystem),
			this._makeCell(route[route.length-1].StarSystem),
			this._makeCell(`${route.length-1}j`)
		);

		if (route.length === 2) {
			// single-jump route

			dist = longest = distance3(route[0].StarPos, route[1].StarPos);
			row.append(this._makeCell(`${dist.toFixed(2)}ly`), this._makeCell(""));
		} else {
			// sum jump distances

			let cur;
			for (const wp of route) {
				if (!cur) {
					// start system
					cur = wp.StarPos;
					// distance to destination system
					row.append(this._makeCell(`${distance3(cur, route[route.length-1].StarPos).toFixed(2)}ly`));
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

			row.append(this._makeCell(`${dist.toFixed(2)}ly`));
		}

/*
		// update the record
		if (maxrange < longest) {
			maxrange = longest;
			gameStats.set("Max jump range", `${longest.toFixed(2)}ly`);
		}
*/

		const cell = this._makeCell(`${longest.toFixed(2)}ly`);
		if (longest >= 200) {
			cell.classList.add("longjump");
		}

		row.append(cell);

		this._addRow(row);
	}
}


// const distanceN = (v0, v1) => Math.hypot(...v0.map((v, i) => v - v1[i]));
const distance3 = (v0, v1) => Math.hypot(v0[0] - v1[0], v0[1] - v1[1], v0[2] - v1[2]); // subtract vectors, return length


export default NavRouteModule;
