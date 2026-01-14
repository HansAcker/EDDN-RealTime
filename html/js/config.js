// import { RegionMap } from "#ed/RegionMap.js";

export const Config = {
	// load templates from template_XX.html
	// TODO: define and match against supportedLocales?
	templateLocale: "en",
//	templateLocale = navigator.language?.split("-")?.[0]?.toLowerCase() ?? "en",

	// options for Intl.NumberFormat
//	numberLocale: "en",
//	numberOptions: { notation: "standard", useGrouping: "always" },

	// options for Intl.RelativeTimeFormat
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
