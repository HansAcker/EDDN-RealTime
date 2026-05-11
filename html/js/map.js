import { Config } from "#config.js";

import { EDDNClient } from "#eddn/EDDNClient.js";
import { ReconnectingWebSocket } from "#ws/ReconnectingWebSocket.js";
import { CachedPageIconActivity } from "#ui/activity_icon.js";
import { RegionMap } from "#ed/RegionMap.js";


console.debug("Main: start");


// The EDDN event bus
const eddn = new EDDNClient({
	url: Config.websocket_url,
	resetTimeout: Config.resetTimeout,

	// ReconnectingWebSocket handles transient connection errors
	WebSocketClass: ReconnectingWebSocket,

	// pass only a subset of messages to display modules
	//filter: (event) => (event.eventType === "journal:fsdjump" && event.age <= 60000 && event.StarPos),
});
eddn.addEventListener("eddn:error", (event) => console.error(`EDDN error: ${event.message} - ${event.error}`));


// Reflect websocket activity in page icon
const activity = new CachedPageIconActivity(window.icon, Config.idleTimeout);
eddn.addEventListener("open", () => activity.idle());
eddn.addEventListener("close", () => activity.off());
eddn.addEventListener("error", () => activity.error());
eddn.addEventListener("eddn:message", () => activity.ok()); // all valid messages passing the filter
eddn.addEventListener("eddn:error", () => activity.error()); // parse errors


async function waitForObj(obj) {
	return new Promise((resolve, reject) => {
		if (!obj) {
			return reject(new Error("Element not found."));
		}

		const checkComplete = (doc) => doc && doc.URL !== "about:blank" && doc.readyState === "complete";

		try {
			if (checkComplete(obj.contentDocument)) {
				return resolve();
			}
		} catch (err) {
			return reject(new Error("Cannot access contentDocument.", { cause: err }));
		}

		const timer = setTimeout(() => reject(new Error("Load timed out.")), 10000);

		obj.addEventListener("load", () => {
			clearTimeout(timer);
			try {
				console.debug("load fired on obj:", obj);
				if (checkComplete(obj.contentDocument)) {
					return resolve();
				}
				// TODO: this appears to fail sometimes in some browsers (Firefox 140 ESR)
				//       - debug more: does the load event trigger on the blank placeholder?
				//       - listen for a second load event?
				//reject(new Error("TODO: Loaded but not ready"));
				console.warning("Loaded but not ready:", obj);
			} catch (err) {
				reject(new Error("Cannot access contentDocument.", { cause: err }));
			}
		}, { "once": false });
	});
}


try {
	await Promise.all([
		RegionMap.ready,
		activity.ready,
		document.fonts.load("10px orbitron"),
		waitForObj(document.getElementById("regions")),
	]);
} catch (err) {
	console.error("Main: abort");
	throw err;
}

console.debug("Main: load done");


{

// plot uses half the resolution of the region map
const MAP_SIZE = RegionMap.MAP_SIZE / 2;
const MAP_SCALE = RegionMap.MAP_SCALE / 2;

const X0 = RegionMap.X0;
const Y0 = RegionMap.Y0;
const Z0 = RegionMap.Z0;


const regionDoc = document.getElementById("regions").contentDocument;

// add rules to SVG CSS
regionDoc.querySelector("style").prepend(document.createTextNode(`
	@import "../css/regionmap.css";
`));

// store references to region paths
const regionPaths = Array.from({ length: 43 }, (_, id) =>
	regionDoc.getElementById(`Region_${id.toString().padStart(2, "0")}`));

// highlight-timer handles
const regionTimers = Array.from({ length: 43 }, () => null);
//const regionTimers = new Array(43).fill(null);


const ctx = document.getElementById("plot").getContext("2d");

drawRulers(ctx);

const heatmap = ctx.getImageData(0, 0, MAP_SIZE, MAP_SIZE);
const heatcount = new Uint16Array(MAP_SIZE * MAP_SIZE);
// const heatalts = new Uint32Array(MAP_SIZE * MAP_SIZE);


// dirty-rect
let minX = MAP_SIZE-1, minZ = MAP_SIZE-1, maxX = 0, maxZ = 0;

let renderQueued = false;


eddn.addEventListener("eddn:message", (event) => {
	if (event.age > Config.oldAge || !event.StarPos) {
		return;
	}

	const [x, y, z] = event.StarPos;


	// TODO: round vs floor: more correct but could overrun MAP_SIZE?
	// ly to pixel
	const px = Math.floor((x - X0) * MAP_SCALE);
	const pz = MAP_SIZE-1 - Math.floor((z - Z0) * MAP_SCALE); // canvas origin is top left, map origin is bottom left

	if (px < 0 || px >= MAP_SIZE || pz < 0 || pz >= MAP_SIZE) {
		return;
	}

	highlightRegion(event.Region.id);
	
	const idx = pz * MAP_SIZE + px;

/*
	// 32 altitude bands, mark in altitude map
	const py = Math.floor((y - Y0) * MAP_SCALE * 32/MAP_SIZE);
	const altbit = 1 << py;

	if (heatalts[idx] & altbit) {
		return;
	}

	const alts = heatalts[idx] |= altbit;

	// TODO: mix all altitude colors
	for (let i = 0; i < 32; i++) {
		alts & (1 << i) && altcolor += altcolors[i];
	}
*/

	const count = heatcount[idx] + 1;

	// clamp count at 3 * 255
	if (count > 765) {
		return;
	}

	heatcount[idx] = count;

	// Uint8ClampedArray implies a Math.min(255, ...)

	const blue = count;
	const red = count > 255 ? count - 255 : 0;
	const green = 255; // count > 510 ? count - 510 : 0;
	const alpha = 255;

	const idx32 = idx * 4;
	heatmap.data[idx32] = red;
	heatmap.data[idx32+1] = green;
	heatmap.data[idx32+2] = blue;
	heatmap.data[idx32+3] = alpha;

	// update dirty-rect
	if (minX > px) {
		minX = px;
	}

	if (minZ > pz) {
		minZ = pz;
	}

	if (maxX < px) {
		maxX = px;
	}

	if (maxZ < pz) {
		maxZ = pz;
	}

	if (!renderQueued) {
		renderQueued = true;

		requestAnimationFrame(() => {
			renderQueued = false;

			ctx.putImageData(heatmap, 0, 0, minX, minZ, maxX+1 - minX, maxZ+1 - minZ);
			minX = MAP_SIZE-1, minZ = MAP_SIZE-1, maxX = 0, maxZ = 0;
		});
	}
});


function highlightRegion(id) {
	const path = regionPaths[id];

	if (!path) {
		console.warning("No path for id: ", id);
		return;
	}

	if (regionTimers[id]) {
		clearTimeout(regionTimers[id]);
	} else {
		path.classList.add("active");
	}

	// TODO: the browser could throttle or suspend timers,
	//       resulting in falsely highlighted paths when the page becomes active
	//       - do an expire run in animation frame? visibility change?
	regionTimers[id] = setTimeout(() => {
		path.classList.remove("active");
		regionTimers[id] = null;
	}, 300);
}


function drawRulers(ctx) {
	const unitSize = 1000 * MAP_SCALE;

	const width = 99 * unitSize;
	const height = 99 * unitSize;

	const pX0 = -X0 * MAP_SCALE;
	const pZ0 = MAP_SIZE-1 - (-Z0 * MAP_SCALE);

	// Colors and styles
	ctx.lineWidth = 1;
	ctx.fillStyle = "orange";
	ctx.strokeStyle = "orange";
	ctx.font = "10px orbitron, sans-serif";
	ctx.textAlign = "center";
	ctx.textBaseline = "top";

	// no epsilon magic: the current MAP_SCALE should always produce exact representations

	// Horizontal ruler ticks
	for (let x = pX0 % unitSize; x < width; x += unitSize) {
		const pos = x - pX0;
		const isMajor = pos % (unitSize * 10) === 0;
		const tickLen = isMajor ? 15 : (pos % (unitSize * 5) === 0  ? 10 : 5);

		ctx.beginPath();
		ctx.moveTo(x + 0.5, 0);
		ctx.lineTo(x + 0.5, 0 + tickLen);
		ctx.stroke();

		if (isMajor) {
			ctx.fillText(pos / unitSize, x, 20);
		}
	}

	// Vertical ruler ticks
	ctx.textAlign = "left";
	ctx.textBaseline = "middle";
	for (let y = pZ0 % unitSize; y < height; y += unitSize) {
		const pos = y - pZ0;
		const isMajor = pos % (unitSize * 10) === 0;
		const tickLen = isMajor ? 15 : (pos % (unitSize * 5) === 0  ? 10 : 5);

		ctx.beginPath();
		ctx.moveTo(MAP_SIZE-1, y + 0.5);
		ctx.lineTo(MAP_SIZE-1 - tickLen, y + 0.5);
		ctx.stroke();

		if (isMajor) {
			ctx.save();
			ctx.translate(MAP_SIZE-1 - 25, y + 3);
			ctx.rotate(-Math.PI / 2);
			ctx.fillText(-pos / unitSize, 0, 0);
			ctx.restore();
		}
	}
}

}


eddn.connect();


console.debug("Main: init done");
