import { EDDNEvent } from "eddn/EDDNEvent.js";


// TODO: current use-case never calls .close(), untested


export class EDDNClient extends EventTarget {
	#WebSocketClass; // the WebSocket class prototype used to create a new connection, defaults to WebSocket
	#abortController = null; // event handler decoupler
	#socket = null;

	#lastEvent; // timestamp of last valid message from socket
	#watchdogTimer = null;

	#textDecoder = new TextDecoder("utf-8"); // decodes JSON bytes to string
	#filterFunction = () => true; // accept all messages

	url = "ws://127.0.0.1:8081";

	resetTimeout = 0; // idle timeout (ms) before watchdog reconnects the socket, 0 to disable watchdog
	protocol = []; // ["v2.ws.eddn-realtime.space", "v1.ws.eddn-realtime.space"]; // currently unused


	constructor(options = {}) {
		super();

		const { url, resetTimeout, filter, WebSocketClass, signal } = options;

		// TODO: use URL() to validate?
		this.url = url ?? this.url;

		// TODO: verify interface, .prototype instanceof EventTarget && typeof .OPEN === "number"?
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
				payload = JSON.parse(this.#textDecoder.decode(rawData));
			}

			// Text frames
			else if (typeof rawData === "string") {
				payload = JSON.parse(rawData);
			}

			else {
				throw new Error(`Unexpected message format (${typeof rawData})`);
			}
		} catch (e) {
			this.dispatchEvent(new ErrorEvent("eddn:error", { message: "Message parse error", error: e }));
			return;
		}

		// TODO: if validation fails, pass on the received data as a field on a custom EDDNErrorEvent

		let event;
		try {
			const { $schemaRef, header, message } = payload;

			if (!$schemaRef || !header || !message) {
				throw new Error("Missing required properties");
			}

			// TODO: why not pass on `payload` instead?
			//       - this normalizes the top level, ignoring additional properties
			//       - the clients could want additional properties if EDDN ever defines them
			//       - EDDNEvent already extracts these properties
			event = new EDDNEvent("eddn:message", { $schemaRef, header, message });

			// get game event type from schema or journal event
			if (!event.eventType) {
				throw new Error("Unknown event type");
			}
		} catch (e) {
			this.dispatchEvent(new ErrorEvent("eddn:error", { message: "Message content error", error: e }));
			return;
		}

		// update watchdog timestamp
		this.#lastEvent = Date.now();

		if (this.#filterFunction(event)) {
			this.dispatchEvent(event);
		}
	}


	#handleOpen(originalEvent) {
		// TODO: an unexpected open should not happen. close()?
		if (this.#socket !== originalEvent.target) {
			console.warn("EDDNClient: spurious `open` from unknown socket:", originalEvent);
			return;
		}

		console.log(`EDDNClient: WebSocket connected${this.#socket.protocol ? ` with protocol '${this.#socket.protocol}'` : ""}`);

		// clear any previous timer
		clearTimeout(this.#watchdogTimer);
		this.#watchdogTimer = null;

		this.#lastEvent = Date.now();

		// start watchdog timer
		if (this.resetTimeout > 0) {
			this.#watchdog();
		}

		// Dispatch a new Event so `target` refers to this class instance, not the internal WebSocket
		this.dispatchEvent(new Event("open"));
	}


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
		this.dispatchEvent(new CloseEvent("close", {
			code: originalEvent.code,
			reason: originalEvent.reason,
			wasClean: originalEvent.wasClean
		}));
	}


	#handleError(originalEvent) {
		if (this.#socket !== originalEvent.target) {
			console.warn("EDDNClient: spurious `error` from unknown socket:", originalEvent);
			return;
		}

		console.error("EDDNClient: WebSocket Error received");
		this.dispatchEvent(new Event("error"));
	}


	#attachEventHandlers(target, signal) {
		target.addEventListener("open", (ev) => this.#handleOpen(ev), { signal });
		target.addEventListener("close", (ev) => this.#handleClose(ev), { signal });
		target.addEventListener("error", (ev) => this.#handleError(ev), { signal });
		target.addEventListener("message", (ev) => this.#handleMessage(ev), { signal });
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
