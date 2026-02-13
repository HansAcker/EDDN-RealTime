/**
 * @module EDDNClient
 * @description WebSocket client for connecting to EDDN relay servers, parsing
 * incoming messages into {@link EDDNEvent} instances, and re-dispatching them
 * as DOM-style events. Includes connection watchdog and optional message filtering.
 */

import { EDDNEvent } from "#eddn/EDDNEvent.js";


/**
 * WebSocket client that connects to an EDDN relay, parses incoming messages
 * into {@link EDDNEvent} instances, and re-dispatches them as DOM-style events.
 *
 * Emitted events:
 * - `open`          – the underlying WebSocket connection opened.
 * - `close`         – the underlying WebSocket connection closed.
 * - `error`         – a WebSocket-level error occurred.
 * - `eddn:message`  – a valid EDDN message was received (dispatched as {@link EDDNEvent}).
 * - `eddn:error`    – an EDDN message could not be parsed or validated.
 *
 * @extends EventTarget
 */
export class EDDNClient extends EventTarget {
	#WebSocketClass; // the WebSocket class prototype used to create a new connection, defaults to WebSocket

	#abortController = null; // event handler decoupler
	#textDecoder = null; // decodes bytes to string (binary frames)
	#socket = null;

	#lastEvent = null; // timestamp of last valid message from socket
	#watchdogTimer = null;

	#filterFunction = () => true; // accept all messages

	#protocol = []; // ["v2.ws.eddn-realtime.space", "v1.ws.eddn-realtime.space"]; // currently unused

	url = "ws://127.0.0.1:8081";

	resetTimeout = 0; // idle timeout (ms) before watchdog reconnects the socket, 0 to disable watchdog

	[Symbol.dispose] = () => this.close(); // support `using client = new EDDNClient()`


	/**
	 * Creates a new EDDNClient.
	 *
	 * @param {object} [options={}] - Configuration options.
	 * @param {string} [options.url] - WebSocket URL to connect to.
	 * @param {number} [options.resetTimeout] - Idle timeout in ms before the watchdog reconnects.
	 * @param {(event: any) => boolean} [options.filter] - Predicate applied to each {@link EDDNEvent}; returning `false` suppresses dispatch.
	 * @param {typeof WebSocket} [options.WebSocketClass] - WebSocket constructor to use (defaults to the global `WebSocket`).
	 * @param {AbortSignal} [options.signal] - An AbortSignal that, when aborted, closes the connection.
	 */
	constructor(options = {}) {
		super();

		const { url, resetTimeout, filter, WebSocketClass, signal } = options;

		// TODO: use URL() to validate / check for "^wss?://"?
		this.url = url ?? this.url;

		this.#WebSocketClass = WebSocketClass ?? WebSocket;

		if (resetTimeout) {
			if (!Number.isInteger(resetTimeout)) {
				throw new Error("resetTimeout must be an integer");
			}

			this.resetTimeout = resetTimeout;
		}

		if (filter) {
			if (typeof filter !== "function") {
				throw new Error("filter must be a function");
			}

			this.#filterFunction = filter;
		}

		// close connection on optional abort signal
		// TODO: block `connect()` after abort?
		signal?.addEventListener("abort", () => this.close(), { once: true });
	}


	/**
	 * Opens a new WebSocket connection. If a connection is already open it is
	 * closed first.
	 */
	connect() {
		// close and clear old socket on reconnect
		if (this.#socket) {
			this.close();
		}

		console.debug("EDDNClient: connecting");

		// a signal to close the socket and detach all handlers
		this.#abortController = new AbortController();
		const signal = this.#abortController.signal;

		// pass abort signal into WebSocket class if it supports it
		this.#socket = new this.#WebSocketClass(this.url, this.#protocol, { signal });
		this.#socket.binaryType = "arraybuffer";

		this.#attachEventHandlers(this.#socket, signal);
	}


	/**
	 * Closes the current WebSocket connection, stops the watchdog timer,
	 * detaches all event handlers, and dispatches a synthetic `close` event.
	 */
	close() {
		console.debug("EDDNClient: closing");

		// cleanup any old watchdog
		this.#stopWatchdog();

		// cleanup listeners immediately
		this.#abortController?.abort();
		this.#abortController = null;

		// discard WebSocket instance
		this.#socket?.close();
		this.#socket = null;

		console.log("EDDNClient: WebSocket removed");

		// inform event listeners now because there won't be a `close` from the socket later
		this.dispatchEvent(new CloseEvent("close", {
			code: 1000,
			reason: "EDDNClient.close() called",
			wasClean: true
		}));
	}


	/**
	 * Handles a raw WebSocket `message` event by parsing the data and
	 * forwarding it to {@link EDDNClient#handleEDDNMessage}.
	 *
	 * @param {MessageEvent} originalEvent - The WebSocket message event.
	 */
	#handleMessage(originalEvent) {
		if (this.#socket !== originalEvent.target) {
			console.warn("EDDNClient: spurious `message` from unknown socket:", originalEvent);
			return;
		}

		const rawData = originalEvent.data;
		let data;

		try {
			// JSON in Text frames
			if (typeof rawData === "string") {
				data = JSON.parse(rawData);
			}

			// JSON in binary frames
			else if (rawData instanceof ArrayBuffer) {
				data = JSON.parse((this.#textDecoder ??= new TextDecoder("utf-8")).decode(rawData));
			}

			else {
				throw new Error(`Unexpected message format (${typeof rawData})`);
			}
		} catch (err) {
			this.dispatchEvent(new ErrorEvent("eddn:error", { message: "Message parse error", error: err }));
			return;
		}

		this.#handleEDDNMessage(data);
	}

	/**
	 * Validates an EDDN payload, wraps it in an {@link EDDNEvent}, applies the
	 * filter function, and dispatches it if accepted.
	 *
	 * @param {object} data - Parsed EDDN message object.
	 * @param {string} data.$schemaRef - The schema reference URL.
	 * @param {Record<string, any>} data.header - The EDDN header.
	 * @param {Record<string, any>} data.message - The actual game data.
	 */
	#handleEDDNMessage(data) {
		// TODO: if validation fails, pass on the received data as a field on a custom EDDNErrorEvent

		let event;
		try {
			const { $schemaRef, header, message } = data;

			// TODO: check typeof?
			//       - why here and not in EDDNEvent?
			if (!$schemaRef || !header || !message) {
				throw new Error("Missing required properties");
			}
			// TODO: why not pass on `data` instead?
			//       - this normalizes the top level, ignoring additional properties
			//       - the clients could want additional properties if EDDN ever defines them
			//       - EDDNEvent already extracts these properties
			event = new EDDNEvent("eddn:message", { $schemaRef, header, message });

			// get game event type from schema or journal event
			if (!event.eventType) {
				throw new Error("Unknown event type");
			}
		} catch (err) {
			this.dispatchEvent(new ErrorEvent("eddn:error", { message: "Message content error", error: err }));
			return;
		}

		// update watchdog timestamp
		this.#lastEvent = Date.now();

		if (this.#filterFunction(event)) {
			this.dispatchEvent(event);
		}
	}


	/**
	 * Handles the WebSocket `open` event. Resets the watchdog and dispatches
	 * an `open` event to listeners.
	 *
	 * @param {Event} originalEvent - The WebSocket open event.
	 */
	#handleOpen(originalEvent) {
		// TODO: an unexpected open should not happen. close()?
		if (this.#socket !== originalEvent.target) {
			console.warn("EDDNClient: spurious `open` from unknown socket:", originalEvent);
			return;
		}

		console.log(`EDDNClient: WebSocket connected${this.#socket.protocol ? ` with protocol '${this.#socket.protocol}'` : ""}`);

		// reset watchdog
		this.#stopWatchdog();
		this.#watchdog();

		this.#lastEvent = Date.now();

		this.dispatchEvent(new Event("open"));
	}


	/**
	 * Handles the WebSocket `close` event. Stops the watchdog and dispatches a
	 * `close` event to listeners.
	 *
	 * @param {CloseEvent} originalEvent - The WebSocket close event.
	 */
	#handleClose(originalEvent) {
		if (this.#socket !== originalEvent.target) {
			console.warn("EDDNClient: spurious `close` from unknown socket:", originalEvent);
			return;
		}

		console.log("EDDNClient: WebSocket closed");

		// stop watchdog
		this.#stopWatchdog();

		// TODO: a standard WebSocket is "dead" after CLOSED while ReconnectingWebSocket potentially continues
		//       - ReconnectingWebSocket would need to pass `wasForced` or similar?
		//       - duck-type it on the availability of `reconnect()` for now

		// socket closed
		if (typeof this.#socket.reconnect !== "function") {
			this.#socket = null;
		}

		this.dispatchEvent(new CloseEvent("close", {
			code: originalEvent.code,
			reason: originalEvent.reason,
			wasClean: originalEvent.wasClean
		}));
	}


	/**
	 * Handles the WebSocket `error` event and dispatches an `error` event to listeners.
	 *
	 * @param {Event} originalEvent - The WebSocket error event.
	 */
	#handleError(originalEvent) {
		if (this.#socket !== originalEvent.target) {
			console.warn("EDDNClient: spurious `error` from unknown socket:", originalEvent);
			return;
		}

		console.warn("EDDNClient: WebSocket error received");
		this.dispatchEvent(new Event("error"));
	}


	/**
	 * Attaches WebSocket event handlers to the given target.
	 *
	 * @param {WebSocket} target - The WebSocket instance to listen on.
	 * @param {AbortSignal} signal - Signal used to automatically remove the handlers.
	 */
	#attachEventHandlers(target, signal) {
		target.addEventListener("open", (ev) => this.#handleOpen(ev), { signal });
		target.addEventListener("close", (ev) => this.#handleClose(ev), { signal });
		target.addEventListener("error", (ev) => this.#handleError(ev), { signal });
		target.addEventListener("message", (ev) => this.#handleMessage(ev), { signal });
	}


	/**
	 * Periodic watchdog that reconnects the WebSocket if no valid message has
	 * been received within {@link EDDNClient#resetTimeout} milliseconds.
	 */
	#watchdog() {
		// terminate watch when the socket is gone or resetTimeout changed to 0
		if (!this.#socket || this.resetTimeout <= 0) {
			return;
		}

		if (this.#lastEvent && this.#socket.readyState === this.#WebSocketClass.OPEN && (Date.now() - this.#lastEvent) > this.resetTimeout) {
			console.log("EDDNClient: Receive timeout. Resetting connection.");

			// ReconnectingWebSocket has a .reconnect() method
			typeof this.#socket.reconnect === "function" ? this.#socket.reconnect() : this.connect();

			// end this watchdog here - #handleOpen() should start a new one
			return;
		}

		// TODO: options
		const nextWake = ~~(60000 + Math.random() * 42000);
		// console.debug(`watchdog: Sleeping for ${nextWake}ms`);

		this.#watchdogTimer = setTimeout(() => this.#watchdog(), nextWake);
	}


	/**
	 * Stops the watchdog timer and resets the last-event timestamp.
	 */
	#stopWatchdog() {
		clearTimeout(this.#watchdogTimer);
		this.#watchdogTimer = null;
		this.#lastEvent = null;
	}
}
