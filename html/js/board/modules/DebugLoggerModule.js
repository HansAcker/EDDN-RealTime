/**
 * @module board/modules/DebugLoggerModule
 * @description Dashboard module that logs every incoming {@link module:eddn/EDDNEvent}
 * message to the browser console. Useful for development and debugging.
 */

import { DashboardModule } from "#DashboardModule";


/**
 * Dashboard module that logs every incoming EDDN message to the browser
 * console. Useful for development and debugging.
 *
 * @extends DashboardModule
 */
export class DebugLoggerModule extends DashboardModule {
	/**
	 * @param {MessageRouter} router - The message router to subscribe to.
	 */
	constructor(router) {
		// Subscribe to the generic event to catch everything
		super(router, ["*"]);
	}

	/**
	 * Logs event metadata (timestamp, software, schema, event name, system)
	 * to the browser console.
	 *
	 * @param {EDDNEvent} event - The incoming EDDN event.
	 */
	_handleEvent(event) {
		// e.type will be 'eddn:message', so we look at the event's internal data
		const software = event.header.softwareName;
		const timestamp = event.receiveTimestamp.toLocaleTimeString();
		const schema = event.$schemaRef.replace(/.*\/([^/]*\/[^/]*)$/, "$1");
		const jevent = event.eventName ?? "";

		// Extensible: We can process data regardless of schema
		console.log(`[${timestamp}] received from ${software} ( ${schema} ${jevent} ${event.StarSystem})` );
	}
}


export default DebugLoggerModule;
