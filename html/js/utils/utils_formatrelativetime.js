// time rounding units in seconds
// __PURE__ for esbuild: declare Object.freeze() as side-effect-free
const time_units = /* @__PURE__ */ Object.freeze([
	/* @__PURE__ */ Object.freeze({ unit: "year", seconds: 31536000 }),
	/* @__PURE__ */ Object.freeze({ unit: "month", seconds: 2592000 }),
	/* @__PURE__ */ Object.freeze({ unit: "day", seconds: 86400 }),
	/* @__PURE__ */ Object.freeze({ unit: "hour", seconds: 3600 }),
	/* @__PURE__ */ Object.freeze({ unit: "minute", seconds: 60 })
]);

let defaultTimeFormatter;


/**
 * Formats a number of ms into a relative time string.
 * @param {number} diffMs - Relative time in ms (positive: past, negative: future)
 * @param {Intl.RelativeTimeFormat} [formatter] - RelativeTimeFormat instance to use.
 * @returns {string|undefined} - Relative time string (e.g., "5 minutes ago", "in 2 hours") or undefined if diffMs is NaN.
 */
export function formatRelativeTime(diffMs, formatter) {
	if (typeof diffMs !== "number") {
		return undefined;
	}

	formatter ??= (defaultTimeFormatter ??= new Intl.RelativeTimeFormat());

	const diffSec = Math.round(-diffMs / 1000); // Intl.RelativeTimeFormat: negative past, positive future
	const diffAbs = Math.abs(diffSec);

	if (diffAbs < 60) {
		return formatter.format(diffSec, "second");
	}

	// TODO: reverse the lookup? "minutes ago" happens more often than "years ago"
	for (const { unit, seconds } of time_units) {
		if (diffAbs >= seconds) {
			return formatter.format(Math.round(diffSec / seconds), unit);
		}
	}

	// NaN ends up here
	return undefined;
}
