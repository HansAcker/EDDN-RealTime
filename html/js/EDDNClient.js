import { EDDNEvent } from "EDDNEvent";


export class EDDNClient extends EventTarget {
	#WebSocketClass;

	#lastEvent;
	#watchdogTimer;

	url;
	socket = null;
	resetTimeout = 300000;
	protocol = "v1.ws.eddn-realtime.space";

	constructor(url = "ws://127.0.0.1:8081", options = {}) {
		super();

		this.url = url;

		const { signal, WebSocketClass } = options;
		// Object.assign(this, config);

		this.#WebSocketClass = WebSocketClass ?? WebSocket;

		// close websocket on abort signal
		signal?.addEventListener("abort", () => this.close());
	}

	connect() {
		this.close();

		this.socket = new this.#WebSocketClass(this.url, this.protocol);

		this.socket.addEventListener("open", (ev) => this.#handleOpen(ev));
		this.socket.addEventListener("close", (ev) => this.#handleClose(ev));
		this.socket.addEventListener("error", (ev) => this.#handleError(ev));
		this.socket.addEventListener("message", (ev) => this.#handleMessage(ev));
	}

	close() {
 		// cleanup any old watchdog and socket
		clearTimeout(this.#watchdogTimer);
		this.#watchdogTimer = null;
		this.#lastEvent = null;

		const socket = this.socket;
		this.socket = null;

		if (!socket || socket.readyState === WebSocket.CLOSED) {
			return;
		}

		socket.close();
	}

	#handleMessage(originalEvent) {
		if (this.socket !== originalEvent.target) return;

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

		const eventType = EDDNEvent.getEventType(payload);

		if (!eventType) {
			this.dispatchEvent(new ErrorEvent("eddn:error", { message: "Unknown event type" }));
			return;
		}

		this.#lastEvent = Date.now();

		const eventData = {
			$schemaRef: payload.$schemaRef,
			header: payload.header,
			message: payload.message
		};

		if (this.dispatchEvent(new EDDNEvent("eddn:filter", eventData))) {
			this.dispatchEvent(new EDDNEvent("eddn:message", eventData));
			this.dispatchEvent(new EDDNEvent(eventType, eventData));
		}
	}


	#handleOpen(originalEvent) {
		if (this.socket !== originalEvent.target) return;

		console.log("EDDN Stream connected");

		// start watchdog timer
		this.#lastEvent = Date.now();
		this.#watchdog();

		// Dispatch a new Event so 'target' refers to this EDDNClient instance, not the internal WebSocket
		this.dispatchEvent(new Event("open"));
	}

	#handleClose(originalEvent) {
		if (this.socket !== originalEvent.target) return;

		// stop watchdog
		clearTimeout(this.#watchdogTimer);
		this.#watchdogTimer = null;
		this.#lastEvent = null;

		// socket closed
		this.socket = null;

		// Create a new CloseEvent to forward specific close codes/reasons to the UI
		const event = new CloseEvent("close", {
			code: originalEvent.code,
			reason: originalEvent.reason,
			wasClean: originalEvent.wasClean
		});

		this.dispatchEvent(event);
	}

	#handleError(originalEvent) {
		if (this.socket !== originalEvent.target) return;
		console.error("EDDN Error received");
		this.dispatchEvent(new Event("error"));
	}


	#watchdog() {
		if (!this.socket) {
			return;
		}

		if (this.#lastEvent && this.socket.readyState === WebSocket.OPEN && (Date.now() - this.#lastEvent) > this.resetTimeout) {
			console.log("Receive timeout. Resetting connection.");
			// ReconnectingWebSocket has a .reconnect() method
			this.socket.reconnect ? this.socket.reconnect() : this.connect();
			// end this watchdog here - #handleOpen() should start a new one
			return;
		}

		// TODO: options
		const nextWake = ~~(60000 + Math.random() * 42000);
		// console.log(`watchdog: Sleeping for ${nextWake}ms`);

		this.#watchdogTimer = setTimeout(() => this.#watchdog(), nextWake);
	}
}
