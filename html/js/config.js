/**
 * @module config
 * @description Application-wide configuration constants and locale-aware formatters.
 */

/** @type {string} Default locale from browser settings. */
const language = navigator.language ?? "en";

/**
 * Global configuration object for the EDDN RealTime dashboard.
 *
 * @type {Readonly<{websocket_url: string, idleTimeout: number, resetTimeout: number, oldAge: number, newAge: number, longJump: number,
 *   templateLocale: string, numberLocale: string, timeLocale: string, timeOptions: Record<string, any>, globalEventFilter?: (event: any) => boolean,
 *   _numberFormat: Intl.NumberFormat, _relTimeFormat: Intl.RelativeTimeFormat}>}
 * @property {string} websocket_url - WebSocket endpoint for the EDDN relay.
 * @property {number} idleTimeout - Milliseconds before the connection status changes to "idle".
 * @property {number} resetTimeout - Milliseconds before the watchdog resets the WebSocket connection.
 * @property {number} oldAge - Millisecond threshold for marking messages as old.
 * @property {number} newAge - Millisecond threshold for marking messages as new (negative = future).
 * @property {number} longJump - Threshold in ly for highlighting the longest hop in NavRoute.
 * @property {string} templateLocale - Locale code used to load HTML template files.
 * @property {string} numberLocale - Locale passed to {@link Intl.NumberFormat}.
 * @property {string} timeLocale - Locale passed to {@link Intl.RelativeTimeFormat}.
 * @property {Record<string, any>} timeOptions - Options passed to {@link Intl.RelativeTimeFormat}.
 * @property {Intl.NumberFormat} _numberFormat - Shared number formatter instance.
 * @property {Intl.RelativeTimeFormat} _relTimeFormat - Shared relative-time formatter instance.
 * @property {(event: EDDNEvent) => boolean} [globalEventFilter] - Optional predicate applied to every incoming {@link EDDNEvent}.
 */
export const Config = {
	websocket_url: "wss://ws.eddn-realtime.space/eddn",

	// set status to "idle" after idleTimeout ms without valid messages
	idleTimeout: 2300,

	// reset websocket connection after resetTimeout ms without valid messages
	resetTimeout: 300 * 1000,

	// message age thresholds for old/new stats
	oldAge: 3600 * 1000,
	newAge: 180 * -1000,

	// route hop highlight threshold
	longJump: 200,

	// load templates from template_XX.html
	// TODO: define and match against supportedLocales?
	templateLocale: "en",
//	templateLocale: language.split("-")[0].toLowerCase(),

	// override options for Intl.NumberFormat
	numberLocale: language,
//	numberOptions: { notation: "compact" },

	// override options for Intl.RelativeTimeFormat
	timeLocale: language,
	timeOptions: { style: "narrow" },

	// filter events in EDDClient
/*
	globalEventFilter: (event) => (
//		(event.age < 0) || (event.isMulticrew) ||
		(event.StarSystem.startsWith("HIP ")) ||
		(event.message?.Route?.some((wp) => wp?.StarSystem?.startsWith("HIP "))) ||
		(event.Region.id && event.Region.id !== 18) ||
//		(event.StarPos && ["Perseus Arm", "The Abyss", "Elysian Shore"].includes(event.Region.name)) ||
//		(true)
		(false)
	),
*/
};

// initialize static formatters
Config._numberFormat = new Intl.NumberFormat(Config.numberLocale, Config.numberOptions);
Config._relTimeFormat = new Intl.RelativeTimeFormat(Config.timeLocale, Config.timeOptions);

// nothing more to add
Object.freeze(Config);


export default Config;
