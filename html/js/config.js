// import { RegionMap } from "#ed/RegionMap.js";


// default locale from browser settings
const language = navigator.language ?? "en";

export const Config = {
	websocket_url: "wss://ws.eddn-realtime.space/eddn",

	resetTimeout: 300 * 1000,

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

/*
	// filter events in EDDClient
	globalEventFilter: (event) => (
//		(event.age < 0) || (event.isMulticrew) ||
		(event.StarSystem.startsWith("HIP ")) ||
		(event.message?.Route?.some((wp) => wp?.StarSystem?.startsWith("HIP "))) ||
//		(event.StarPos && RegionMap.isReady && RegionMap.findRegion(...event.StarPos).id === 0) ||
		(event.StarPos && RegionMap.isReady && RegionMap.findRegion(...event.StarPos).id !== 18) ||
//		(event.StarPos && ["Perseus Arm", "The Abyss", "Elysian Shore"].includes(RegionMap.findRegion(...event.StarPos).name)) ||
//		(true)
		(false)
	),
*/
};

// initialize static formatters
Config.numberFormat = new Intl.NumberFormat(Config.numberLocale, Config.numberOptions);
Config.relTimeFormat = new Intl.RelativeTimeFormat(Config.timeLocale, Config.timeOptions);

// nothing more to add
Object.freeze(Config);


export default Config;
