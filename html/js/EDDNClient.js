import { EDDNEvent } from "EDDNEvent";


// TODO: current use-case never calls .close(), untested


export class EDDNClient extends EventTarget {
	#WebSocketClass; // the WebSocket class prototype used to create a new connection, defaults to WebSocket
	#abortController = null; // event handler decoupler

	#lastEvent; // timestamp of last valid message from socket
	#watchdogTimer = null;

	url;
	socket = null;
	resetTimeout = 300000; // idle timeout (ms) before watchdog reconnects the socket, 0 to disable watchdog
	protocol = "v1.ws.eddn-realtime.space"; // currently unused


	constructor(url = "ws://127.0.0.1:8081", options = {}) {
		super();

		const { signal, WebSocketClass, resetTimeout } = options;

		this.url = url;

		// TODO: wrap bare `WebSocket`, eg. for testing under node.js?
		this.#WebSocketClass = WebSocketClass ?? WebSocket;

		if (!isNaN(parseInt(resetTimeout))) {
			this.resetTimeout = parseInt(resetTimeout);
		}

		// close websocket on abort signal
		signal?.addEventListener("abort", () => this.close());
	}


	connect() {
		// close and clear old socket on reconnect
		if (this.socket) {
			this.close();
		}

		console.debug("EDDNClient: connecting");

		// signal method to close the socket and detach all handlers
		this.#abortController = new AbortController();
		const signal = this.#abortController.signal;

		this.socket = new this.#WebSocketClass(this.url, this.protocol, { signal });
		this.#attachEventHandlers(this.socket, signal);
	}


	close() {
		console.debug("EDDNClient: closing");

 		// cleanup any old watchdog and socket
		// TODO: handle async close / reconnect properly
		//       - `close` event is never fired after explicit .close()
		//       - on reconnect, a `close` of the old socket should not trigger after an `open` from the new one

		clearTimeout(this.#watchdogTimer);
		this.#watchdogTimer = null;
		this.#lastEvent = null;

		// cleanup listeners immediately
		this.#abortController?.abort();
		this.#abortController = null;

		this.socket?.close();
		this.socket = null;

		// TODO: possibly dispatch a CloseEvent to clients here
	}


	#handleMessage(originalEvent) {
		// TODO: re-think multiple deliveries in reconnect case. close this socket?
		if (this.socket !== originalEvent.target) {
			console.warn("EDDNClient: spurious `message` from unknown socket:", originalEvent);
			return;
		}

		let payload;

		try {
			payload = JSON.parse(originalEvent.data);
		} catch (e) {
			this.dispatchEvent(new ErrorEvent("eddn:error", { message: "JSON parse error", error: e }));
			return;
		}

		if (!(payload.$schemaRef && payload.header && payload.message)) {
			this.dispatchEvent(new ErrorEvent("eddn:error", { message: "Missing required properties" }));
			return;
		}

		// get client event type from schema or journal event
		const eventType = EDDNEvent.getEventType(payload);

		// TODO: still dispatch eddn:filter and eddn:message?
		if (!eventType) {
			this.dispatchEvent(new ErrorEvent("eddn:error", { message: "Unknown event type" }));
			return;
		}

		// update watchdog timestamp
		this.#lastEvent = Date.now();

		// TODO: why not just pass on `payload`?
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
		if (this.socket !== originalEvent.target) {
			console.warn("EDDNClient: spurious `open` from unknown socket:", originalEvent);
			return;
		}

		console.log("EDDNClient: WebSocket connected");

		// clear any previous timer
		clearTimeout(this.#watchdogTimer);
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
		// TODO: esnure that the old socket is closed?
		if (this.socket !== originalEvent.target) {
			console.warn("EDDNClient: spurious `close` from unknown socket:", originalEvent);
			return;
		}

		// stop watchdog
		clearTimeout(this.#watchdogTimer);
		this.#watchdogTimer = null;
		this.#lastEvent = null;

		// TODO: a standard WebSocket is "dead" after CLOSED while ReconnectingWebSocket potentially continues
		//       - ReconnectingWebSocket would need to pass `wasForced` or similar?
		//       - duck-type it on the availability of `reconnect()` for now
		// socket closed
		if (typeof this.socket.reconnect !== "function") {
			this.socket = null;
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
		if (this.socket !== originalEvent.target) {
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
		// TODO: ensure that only one watchdog runs
		// terminate watch when the socket is gone
		if (!this.socket || this.resetTimeout <= 0) {
			return;
		}

		if (this.#lastEvent && this.socket.readyState === WebSocket.OPEN && (Date.now() - this.#lastEvent) > this.resetTimeout) {
			console.log("EDDNClient: Receive timeout. Resetting connection.");

			// ReconnectingWebSocket has a .reconnect() method
			typeof this.socket.reconnect === "function" ? this.socket.reconnect() : this.connect();

			// end this watchdog here - #handleOpen() should start a new one
			// TODO: ReconnectingWebSocket should handle reconnections from here. keep watch on standard WebSocket?
			return;
		}

		// TODO: options
		const nextWake = ~~(60000 + Math.random() * 42000);
		// console.log(`watchdog: Sleeping for ${nextWake}ms`);

		this.#watchdogTimer = setTimeout(() => this.#watchdog(), nextWake);
	}
}
