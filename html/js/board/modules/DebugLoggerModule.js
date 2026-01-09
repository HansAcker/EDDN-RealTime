import DashboardModule from "DashboardModule";


export class DebugLoggerModule extends DashboardModule {
	constructor(router) {
		// Subscribe to the generic event to catch everything
		super(router, ["*"]);
	}

	_handleEvent(event) {
		// e.type will be 'eddn:message', so we look at the event's internal data
		const software = event.header.softwareName;
		const timestamp = event.timestamp.toLocaleTimeString();
		const schema = event.schemaRef.replace(/.*\/([^\/]*\/[^\/]*)$/, "$1");
		const jevent = event.message.event ?? "";

		// Extensible: We can process data regardless of schema
		console.log(`[${timestamp}] received from ${software} ( ${schema} ${jevent} ${event.message.StarSystem})` );
	}
}


export default DebugLoggerModule;
