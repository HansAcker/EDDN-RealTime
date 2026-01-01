import { EDDNEvent } from "EDDNEvent";


// TODO: current use-case never calls .close(), untested


export class EDDNClient extends EventTarget {
	#WebSocketClass; // the WebSocket class prototype used to create a new connection, defaults to WebSocket
	#abortController = null; // event handler decoupler
	#socket = null;

	#lastEvent; // timestamp of last valid message from socket
	#watchdogTimer = null;

	#textDecoder = new TextDecoder("utf-8"); // decodes JSON bytes to string

	url;
	resetTimeout = 300000; // idle timeout (ms) before watchdog reconnects the socket, 0 to disable watchdog
	protocol = ["v2.ws.eddn-realtime.space", "v1.ws.eddn-realtime.space"]; // currently unused


	constructor(url = "ws://127.0.0.1:8081", options = {}) {
		super();

		const { resetTimeout, WebSocketClass, signal } = options;

		this.url = url;

		if (Number.isInteger(resetTimeout)) {
			this.resetTimeout = resetTimeout;
		}

		this.#WebSocketClass = WebSocketClass ?? WebSocket;

		// close connection on optional abort signal
		signal?.addEventListener("abort", () => this.close());
	}


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
		this.#socket = new this.#WebSocketClass(this.url, this.protocol, { signal });
		this.#socket.binaryType = "arraybuffer";

		this.#attachEventHandlers(this.#socket, signal);
	}


	close() {
		console.debug("EDDNClient: closing");

 		// cleanup any old watchdog and socket
		// TODO: handle async close / reconnect properly
		//       - ideally the socket's `close` event would be allowed to trigger and forward
		//       - on reconnect, a `close` of the old socket should not be sent on after an `open` from the new one

		clearTimeout(this.#watchdogTimer);
		this.#watchdogTimer = null;
		this.#lastEvent = null;

		// cleanup listeners immediately
		this.#abortController?.abort();
		this.#abortController = null;

		this.#socket?.close();
		this.#socket = null;

		// inform the client
		this.dispatchEvent(new CloseEvent("close", {
			code: 1000,
			reason: "EDDNClient.close() called",
			wasClean: true
		}));
	}


	#handleMessage(originalEvent) {
		if (this.#socket !== originalEvent.target) {
			console.warn("EDDNClient: spurious `message` from unknown socket:", originalEvent);
			return;
		}

		const rawData = originalEvent.data;
		let payload;

		try {
			// ArrayBuffer binary frames
			if (rawData instanceof ArrayBuffer) {
				const jsonText = this.#textDecoder.decode(rawData);
				payload = JSON.parse(jsonText);
			}

			// Text frames
			else if (typeof rawData === "string") {
				payload = JSON.parse(rawData);
			}

			// binary blob
			else {
				this.dispatchEvent(new ErrorEvent("eddn:error", { message: "Unexpected message format" }));
				return;
			}
		} catch (e) {
			this.dispatchEvent(new ErrorEvent("eddn:error", { message: "Parse error", error: e }));
			return;
		}

		// TODO: if validation fails, pass on the received data as a field on a custom EDDNErrorEvent

		if (!(payload.$schemaRef && payload.header && payload.message)) {
			this.dispatchEvent(new ErrorEvent("eddn:error", { message: "Missing required properties" }));
			return;
		}

		// get client event type from schema or journal event
		const eventType = EDDNEvent.getEventType(payload);

		if (!eventType) {
			this.dispatchEvent(new ErrorEvent("eddn:error", { message: "Unknown event type" }));
			return;
		}

		// update watchdog timestamp
		this.#lastEvent = Date.now();

		// TODO: why not pass on `payload` instead?
		//       - this normalizes the top level, ignoring additional properties
		//       - the clients could want additional properties if EDDN ever defines them
		const eventData = {
			$schemaRef: payload.$schemaRef,
			header: payload.header,
			message: payload.message
		};

		// listeners on `eddn:filter` can call `preventDefault()` to filter a mesasge
		if (this.dispatchEvent(new EDDNEvent("eddn:filter", eventData))) {
			// the catch-all event
			this.dispatchEvent(new EDDNEvent("eddn:message", eventData));

			// schema-specific events
			this.dispatchEvent(new EDDNEvent(eventType, eventData));
		}
	}


	#handleOpen(originalEvent) {
		// TODO: an unexpected open should not happen. close()?
		if (this.#socket !== originalEvent.target) {
			console.warn("EDDNClient: spurious `open` from unknown socket:", originalEvent);
			return;
		}

		console.log(`EDDNClient: WebSocket connected${this.#socket.protocol ? ` with protocol '${this.#socket.protocol}` : ""}`);

		// clear any previous timer
		clearTimeout(this.#watchdogTimer);
		this.#watchdogTimer = null;

		this.#lastEvent = Date.now();

		// start watchdog timer
		if (this.resetTimeout > 0) {
			this.#watchdog();
		}

		// Dispatch a new Event so `target` refers to this EDDNClient instance, not the internal WebSocket
		this.dispatchEvent(new Event("open"));
	}


	// TODO: should this class automatically reconnect on close or leave that to its user?
	#handleClose(originalEvent) {
		if (this.#socket !== originalEvent.target) {
			console.warn("EDDNClient: spurious `close` from unknown socket:", originalEvent);
			return;
		}

		console.log("EDDNClient: WebSocket closed");

		// stop watchdog
		clearTimeout(this.#watchdogTimer);
		this.#watchdogTimer = null;

		this.#lastEvent = null;

		// TODO: a standard WebSocket is "dead" after CLOSED while ReconnectingWebSocket potentially continues
		//       - ReconnectingWebSocket would need to pass `wasForced` or similar?
		//       - duck-type it on the availability of `reconnect()` for now

		// socket closed
		if (typeof this.#socket.reconnect !== "function") {
			this.#socket = null;
		}

		// Create a new CloseEvent to forward specific close codes/reasons to the UI
		const event = new CloseEvent("close", {
			code: originalEvent.code,
			reason: originalEvent.reason,
			wasClean: originalEvent.wasClean
		});

		this.dispatchEvent(event);
	}


	// TODO: what else to do for a WebSocket error event? it should be followed by a final "close" event
	#handleError(originalEvent) {
		if (this.#socket !== originalEvent.target) {
			console.warn("EDDNClient: spurious `error` from unknown socket:", originalEvent);
			return;
		}

		console.error("EDDNClient: WebSocket Error received");
		this.dispatchEvent(new Event("error"));
	}


	#attachEventHandlers(target, signal) {
		target.addEventListener("open", (e) => this.#handleOpen(e), { signal });
		target.addEventListener("close", (e) => this.#handleClose(e), { signal });
		target.addEventListener("error", (e) => this.#handleError(e), { signal });
		target.addEventListener("message", (e) => this.#handleMessage(e), { signal });
	}


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
}
