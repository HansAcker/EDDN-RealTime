import { ReconnectingWebSocket } from "ReconnectingWebSocket";
import { EDDNEvent } from "EDDNEvent";


export class EDDNClient extends EventTarget {
	constructor(url = "ws://127.0.0.1:8081", options = {}) {
		super();

		this.url = url;
		this.socket = null;

		const { signal, ...config } = options;
		// Object.assign(this, config);

		// close websocket on abort signal
		signal?.addEventListener("abort", () => this.close());
	}

	connect() {
		this.close();

		this.socket = new ReconnectingWebSocket(this.url);

		this.socket.addEventListener("open", (ev) => this.#handleOpen(ev));
		this.socket.addEventListener("close", (ev) => this.#handleClose(ev));
		this.socket.addEventListener("error", (ev) => this.#handleError(ev));
		this.socket.addEventListener("message", (ev) => this.#handleMessage(ev));
	}

	close() {
		this.socket?.close();
		this.socket = null;
	}

	#handleMessage(ev) {
		let payload;

		try {
			payload = JSON.parse(ev.data);
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
		console.log("EDDN Stream connected");
		// Dispatch a new Event so 'target' refers to this EDDNClient instance, not the internal WebSocket
		this.dispatchEvent(new Event("open"));
	}

	#handleClose(originalEvent) {
		// Create a new CloseEvent to forward specific close codes/reasons to the UI
		const event = new CloseEvent("close", {
			code: originalEvent.code,
			reason: originalEvent.reason,
			wasClean: originalEvent.wasClean
		});

		this.dispatchEvent(event);
	}

	#handleError(originalEvent) {
		console.error("EDDN Error received");
		this.dispatchEvent(new Event("error"));
	}
}
