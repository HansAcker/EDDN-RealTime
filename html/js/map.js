import { Config } from "#config.js";

import { EDDNClient } from "#eddn/EDDNClient.js";
import { ReconnectingWebSocket } from "#ws/ReconnectingWebSocket.js";
import { CachedPageIconActivity } from "#ui/activity_icon.js";
import { RegionMap } from "#ed/RegionMap.js";
import { triggerAnimation } from "#utils.js";


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
				console.warn("Loaded but not ready:", obj);
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
ctx.canvas.width = MAP_SIZE;
ctx.canvas.height = MAP_SIZE;

drawRulers(regionDoc);

const heatmap = ctx.getImageData(0, 0, MAP_SIZE, MAP_SIZE);
const heatcount = new Uint16Array(MAP_SIZE * MAP_SIZE);
// const heatalts = new Uint32Array(MAP_SIZE * MAP_SIZE);


// dirty-rect
let minX = MAP_SIZE-1, minY = MAP_SIZE-1, maxX = 0, maxY = 0;

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
	const py = 0; // Math.floor((y - Y0) * MAP_SCALE);

	if (px < 0 || px >= MAP_SIZE || pz < 0 || pz >= MAP_SIZE) {
		return;
	}

	// StarPos z-axis is y in canvas
	updatePlot(px, pz, py);

	highlightRegion(event.Region.id);
});


function updatePlot(x, y, z) {
	const idx = y * MAP_SIZE + x;

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
	if (minX > x) {
		minX = x;
	}

	if (minY > y) {
		minY = y;
	}

	if (maxX < x) {
		maxX = x;
	}

	if (maxY < y) {
		maxY = y;
	}

	if (!renderQueued) {
		renderQueued = true;

		requestAnimationFrame(() => {
			renderQueued = false;

			ctx.putImageData(heatmap, 0, 0, minX, minY, maxX+1 - minX, maxY+1 - minY);
			minX = MAP_SIZE-1, minY = MAP_SIZE-1, maxX = 0, maxY = 0;
		});
	}


/*
	// 32 altitude bands, mark in altitude map
	const altbit = 1 << (z * 32/MAP_SIZE);

	if (heatalts[idx] & altbit) {
		return;
	}

	const alts = heatalts[idx] |= altbit;

	// TODO: mix all altitude colors
	for (let i = 0; i < 32; i++) {
		alts & (1 << i) && altcolor += altcolors[i];
	}
*/
}


function highlightRegion(id) {
	const path = regionPaths[id];

	if (!path) {
		console.warn("No path for id:", id);
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


function drawRulers(svgDoc) {
	const svgNS = "http://www.w3.org/2000/svg";
	const svg = svgDoc.documentElement;

	// Use full resolution for SVG rulers to match the map's coordinate system (2048x2048)
	const size = RegionMap.MAP_SIZE;
	const scale = RegionMap.MAP_SCALE;
	const unitSize = 1000 * scale;

	// origin offset
	const pX0 = -RegionMap.X0 * scale;
	const pZ0 = size - 1 - (-RegionMap.Z0 * scale);

	const create = (tag, attrs = {}) => {
		const el = svgDoc.createElementNS(svgNS, tag);
		for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
		return el;
	};

	// Create containers with shared styles
	const gH = create("g", { id: "ruler-h", class: "rulerlines" });
	const gV = create("g", { id: "ruler-v", class: "rulerlines" });

	// Horizontal ruler ticks and labels
	const startX = pX0 % unitSize;
	const endX = size - ((size - startX) % unitSize);

	for (let x = startX; x <= endX ; x += unitSize) {
		const pos = x - pX0;
		const tickIdx = Math.round(pos / unitSize);
		const isMajor = tickIdx % 10 === 0;
		const tickLen = isMajor ? 30 : (tickIdx % 5 === 0 ? 20 : 10);

		gH.appendChild(create("line", { x1: x, y1: 0, x2: x, y2: tickLen }));

		if (isMajor) {
			const label = create("text", { x, y: 40, class: "rulertext" });
			label.textContent = tickIdx;
			gH.appendChild(label);
		}
	}

	// Vertical ruler ticks and labels
	const startY = pZ0 % unitSize;
	const endY = size - ((size - startY) % unitSize);

	for (let y = startY; y <= endY ; y += unitSize) {
		const pos = y - pZ0;
		const tickIdx = Math.round(pos / unitSize);
		const isMajor = tickIdx % 10 === 0;
		const tickLen = isMajor ? 30 : (tickIdx % 5 === 0 ? 20 : 10);

		gV.appendChild(create("line", { x1: size - 1, y1: y, x2: size - 1 - tickLen, y2: y }));

		if (isMajor) {
			const tx = size - 1 - 55;
			const label = create("text", { x: tx, y: y, class: "rulertext", "dominant-baseline": "middle", transform: `rotate(-90, ${tx}, ${y})` });
			label.textContent = -tickIdx;
			gV.appendChild(label);
		}
	}

	svg.appendChild(gH);
	svg.appendChild(gV);
}


/*

const container = document.querySelector(".galaxymap");
const plot = document.getElementById("plot");
const regions = document.getElementById("regions");

let state = {
	scale: 1,
	tx: 0,
	ty: 0,
	isDragging: false,
	startX: 0,
	startY: 0
};

function updateTransform() {
	const transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;
	plot.style.transform = transform;
	// TODO: scale SVG viewport instead?
	regions.style.transform = transform;
}

// zoom to cursor
container.addEventListener("wheel", (e) => {
	e.preventDefault();

	const rect = container.getBoundingClientRect();
	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;

	// Calculate point in map space before zoom
	const mapX = (mouseX - state.tx) / state.scale;
	const mapY = (mouseY - state.ty) / state.scale;

	// Update scale (exponential feels smoother)
	const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
	state.scale = Math.min(Math.max(1, state.scale * zoomFactor), 20);

	// Calculate new translation to keep map point under cursor
	state.tx = mouseX - mapX * state.scale;
	state.ty = mouseY - mapY * state.scale;

	// Constrain panning so map doesn't disappear
	if (state.scale === 1) {
		state.tx = 0;
		state.ty = 0;
	}

	updateTransform();
}, { passive: false });

// panning
container.addEventListener("pointerdown", (e) => {
	if (e.button !== 0) return; // Left click only
	state.isDragging = true;
	state.startX = e.clientX - state.tx;
	state.startY = e.clientY - state.ty;
	container.style.cursor = "grabbing";
	container.setPointerCapture(e.pointerId);
});

window.addEventListener("pointermove", (e) => {
	if (!state.isDragging) return;

	state.tx = e.clientX - state.startX;
	state.ty = e.clientY - state.startY;

	updateTransform();
});

window.addEventListener("pointerup", (e) => {
	state.isDragging = false;
	container.style.cursor = "grab";
});

*/

}


{

let mute = true;
const attackTime = 0.05;
const releaseTime = 0.25;
const muteTime = 0.5;


const audioCtx = new AudioContext({ latencyHint: "interactive" });
audioCtx.suspend(); // TODO: prevent auto-resume attempt on osc.start()?


// scale amplitude to allow N active regions without clipping
// TODO: Use another number?
const masterVolume = 1 / 20;
const masterGain = new GainNode(audioCtx, { gain: 0 });
masterGain.connect(audioCtx.destination);


// TODO: something else
const bassWave = createBassWave(audioCtx);

let oscs = [], gains = [];
let stopTimeout = null;


function setupNodes() {
	const now = audioCtx.currentTime + 0.01; // TODO: cargo-cult for phase-synced start?
	console.debug("setupNodes(): now =", now);

	// note oscillators
	oscs = Array.from({ length: 42 }, (_, id) => {
		const freq = 440 * Math.pow(2, (id-12) / 12);

		const oscNode = new OscillatorNode(audioCtx, {
			type: "sine",
			frequency: freq,
		});

		// Inner Orion Spur
		if (id === 18-1) {
			oscNode.frequency.value = 44;
			oscNode.setPeriodicWave(bassWave);

			const lfo_detune = new OscillatorNode(audioCtx, {
				type: "sine",
				frequency: 2.25,
			});

			lfo_detune.connect(new GainNode(audioCtx, { gain: 128 })).connect(oscNode.detune);
			lfo_detune.start(now);
		}

		oscNode.start(now);

		return oscNode;
	});

	// per-oscillator volume control, connected to master mixer
	gains = Array.from(oscs, (oscNode) => {
		const gainNode = new GainNode(audioCtx, { gain: 0 });

		oscNode.connect(gainNode).connect(masterGain);

		return gainNode;
	});

//	return { oscs, gains };
}


function stopNodes() {
	console.debug("stopNodes()");

	for (const oscNode of oscs) {
		oscNode.stop();
		oscNode.disconnect();
	}

	for (const gainNode of gains) {
		gainNode.disconnect();
	}

	oscs = gains = [];
}


function cancelAndHold(param) {
	const now = audioCtx.currentTime;

	const currentValue = param.value;
	param.cancelScheduledValues(now);
	param.setValueAtTime(currentValue, now);
}


function envelope(param, targetValue, targetDuration, startTime) {
	const start = startTime ?? audioCtx.currentTime;
	const end = start + targetDuration;

	// start curve, reach 99% at target time then snap to target volume
	// TODO: why not 95% (3), 98% (4) for a slightly more gentle slope?
	param.setTargetAtTime(targetValue, start, targetDuration / 5);
	param.setValueAtTime(targetValue, end);
}


function playNote(id) {
	const gain = gains[id]?.gain;

	if (!gain) {
		console.warn("No note for id:", id);
		return;
	}

	cancelAndHold(gain);

	const now = audioCtx.currentTime + 0.01; // TODO: rethink arbitrary anti-clicking delay fudge kludge

	envelope(gain, 1, attackTime, now);
	envelope(gain, 0, releaseTime, now + attackTime);
}


eddn.addEventListener("eddn:message", (event) => {
	if (mute || event.age > Config.oldAge || !event.Region?.id) {
		return;
	}

	playNote(event.Region.id-1);
});


document.getElementById("mute").addEventListener("click", (ev) => {
	mute = !mute;
	console.log("mute:", mute);

	if (!mute) {
		if (stopTimeout) {
			clearTimeout(stopTimeout);
			stopTimeout = null;
		}

		if (!oscs.length) {
			setupNodes();
		}

		if (audioCtx.state === "suspended") {
			// click interaction should have unlocked the audio context
			audioCtx.resume()
			.then(() => {
				// theoretically, if the event handler ran between .resume() and .then()
				// a note could be playing already and the oscillators could start at a
				// high point in the gain envelope. TODO: keep "mute" false until here

				// theoretically, too, the first gain control inputs could be processed
				// on the audio thread before the oscillator startup commands

				envelope(masterGain.gain, masterVolume, muteTime);

				ev.target.src = "img/sound/speaker.svg";
				return triggerAnimation(ev.target, "infobox__button--signal-success");
			})
			.catch((err) => {
				console.warn("audioCtx.resume() error:", err);
				return triggerAnimation(ev.target, "infobox__button--signal-error");
			});
		} else {
			cancelAndHold(masterGain.gain);
			envelope(masterGain.gain, masterVolume, muteTime);

			ev.target.src = "img/sound/speaker.svg";
			triggerAnimation(ev.target, "infobox__button--signal-success");
		}
	} else {
		const now = audioCtx.currentTime;

		cancelAndHold(masterGain.gain);
		envelope(masterGain.gain, 0, muteTime, now);

		// cancel notes and mute oscillators
		for (const { gain } of gains) {
			gain.cancelScheduledValues(now + muteTime);
			gain.setValueAtTime(0, now + muteTime);
		}

		stopTimeout = setTimeout(() => stopNodes(), muteTime * 2 * 1000);

		ev.target.src = "img/sound/mute.svg";
//		triggerAnimation(ev.target, "infobox__button--signal-success");
	}
});


function createBassWave(ctx) {
	// Phase offset terms (left at 0 for standard phase alignment)
	const real = new Float32Array(8);

	// Amplitude terms (sine components)
	const imag = new Float32Array([
		0,      // Index 0: DC offset
		1.0,    // Index 1: Fundamental (Foundation sub)
		0.6,    // Index 2: 2nd harmonic (Warmth, octave above)
		1.2,    // Index 3: 3rd harmonic (Resonance peak)
		0.2,    // Index 4: 4th harmonic (Post-cutoff slope)
		0.05,   // Index 5: 5th harmonic
		0.02,   // Index 6: 6th harmonic
		0.01    // Index 7: 7th harmonic
	]);

	return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

/*
function createAnotherWave(ctx) {
	const n = 64; // Number of harmonics
	const real = new Float32Array(n);
	const imag = new Float32Array(n);

	// imag[0] is always ignored. imag[1] is the fundamental.
	for (let i = 1; i < n; i++) {
		// Base sawtooth decay (1/n)
		let amplitude = 1 / i;

		// Resonance simulation: Add a peak around the 6th harmonic
		// This creates the "nasal" or "resonating" quality.
		const resonanceCure = Math.exp(-Math.pow(i - 6, 2) / 4);
		amplitude += resonanceCure * 0.8;

		// Low-pass filter roll-off (reduces harshness)
		const lpf = 1 / (1 + Math.pow(i / 12, 2));

		imag[i] = amplitude * lpf;
	}

	return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}
*/


}


eddn.connect();


console.debug("Main: init done");
