// import { RegionMap } from "#ed/RegionMap.js";


export const Config = {
	// TODO: use this as default?
	// locale: navigator.language?.split("-")?.[0]?.toLowerCase() ?? "en",

	// load templates from template_XX.html
	// TODO: define and match against supportedLocales?
	templateLocale: "en",

	// override options for Intl.NumberFormat
//	numberLocale: "en",
//	numberOptions: { notation: "standard", useGrouping: "always" },

	// override options for Intl.RelativeTimeFormat
//	timeLocale: "en",
	timeOptions: { style: "narrow" },

	websocket_url: "wss://ws.eddn-realtime.space/eddn",

/*
	// filter events in EDDClient
	globalEventFilter: (event) => (
//		(event.age < 0) || (event.isMulticrew) ||
		(event.StarSystem.startsWith("HIP ")) ||
		(event.message?.Route?.some((wp) => wp?.StarSystem?.startsWith("HIP "))) ||
//		(event.StarPos && RegionMap.findRegion(...event.StarPos).id === 0) ||
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
