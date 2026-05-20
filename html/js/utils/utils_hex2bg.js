// 16 colors per nibble
// TODO: improve this "high-contrast" selection?
// __PURE__ for esbuild: declare Object.freeze() as side-effect-free
const hex_colors = /* @__PURE__ */ Object.freeze([
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
export function hex2bg(id) {
	const len = id.length;

	// fixed array join vs string concatenation should not make much of a difference
	// the string needs to be flattened when passed into HTMLElement in both cases
	// TODO: guard against empty string? would return invalid CSS

	const stops = new Array(len);
	const step = 100 / len;
	let start = 0;

	// hex chars to colored blocks
	// characters should be in "0-9" (0x30-0x39), "A-F" (0x41-0x46), "a-f" (0x61-0x66)
	for (let i = 0; i < len; i++) {
		const c = id.charCodeAt(i);
		const color = hex_colors[(c & 0x0f) + (c >> 6) * 9] ?? "#000"; // "C" (0x43) -> 3 + 9 = 12
		// hard stops for blocky look: color starts at i*step, ends at (i+1)*step
		// start could accumulate rounding errors, maybe reset to i*step (no issue with typical 40-character id)
		stops[i] = `${color} ${start}% ${start += step}%`;
	}

	return `linear-gradient(to right, ${stops.join(",")})`;
}
