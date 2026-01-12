class ReconnectingWebSocket extends EventTarget {
	static CONNECTING = WebSocket.CONNECTING;
	static OPEN = WebSocket.OPEN;
	static CLOSING = WebSocket.CLOSING;
	static CLOSED = WebSocket.CLOSED;

	maxReconnectAttempts = Infinity;
	baseReconnectInterval = 1200;
	maxReconnectInterval = 30000;
	reconnectDecay = 1.3;
	jitterFactor = 0.3;
	connectionTimeout = 4000;

	#url;
	#protocols;
	#socket = null;
	#retryCount = 0;
	#forcedClose = false;
	#reconnectTimer = null;
	#connectionTimeoutTimer = null;
	#binaryType = "blob";

	#onopen = null;
	#onmessage = null;
	#onclose = null;
	#onerror = null;

	#onOnlineBound;
	#onOfflineBound;

	constructor(url, protocols = [], options = {}) {
		super();
		this.#url = url;
		this.#protocols = protocols;

		const { signal, ...config } = options;
		Object.assign(this, config);

		if (signal) {
			signal.addEventListener("abort", () => this.close(), { once: true });
		}

		this.#onOnlineBound = () => this.#handleWindowOnline();
		this.#onOfflineBound = () => {};

		window.addEventListener("online", this.#onOnlineBound);
		window.addEventListener("offline", this.#onOfflineBound);

		this.#connect();
	}

	get protocol() {
		return this.#socket?.protocol || "";
	}

	get readyState() {
		if (this.#socket) {
			return this.#socket.readyState;
		}
		return this.#forcedClose ? ReconnectingWebSocket.CLOSED : ReconnectingWebSocket.CONNECTING;
	}

	get url() {
		return this.#url;
	}

	get binaryType() {
		return this.#binaryType;
	}

	set binaryType(value) {
		this.#binaryType = value;
		if (this.#socket) {
			this.#socket.binaryType = value;
		}
	}

	set onopen(cb) { this.#updateHandler("open", cb); }
	get onopen() { return this.#onopen; }

	set onmessage(cb) { this.#updateHandler("message", cb); }
	get onmessage() { return this.#onmessage; }

	set onclose(cb) { this.#updateHandler("close", cb); }
	get onclose() { return this.#onclose; }

	set onerror(cb) { this.#updateHandler("error", cb); }
	get onerror() { return this.#onerror; }

	#updateHandler(type, newHandler) {
		const propName = `#on${type}`;
		if (this[propName]) {
			this.removeEventListener(type, this[propName]);
		}
		this[propName] = newHandler;
		if (typeof newHandler === "function") {
			this.addEventListener(type, newHandler);
		}
	}

	send(data) {
		if (this.#socket && this.#socket.readyState === ReconnectingWebSocket.OPEN) {
			this.#socket.send(data);
		} else {
			throw new DOMException("WebSocket is not open. Wait for 'open' event.", "InvalidStateError");
		}
	}

	reconnect() {
		if (this.#forcedClose) {
			throw new DOMException("Cannot reconnect a closed WebSocket.", "InvalidStateError");
		}

		if (this.#socket) {
			this.#removeSocketListeners(this.#socket);
			this.#socket.close(1000, "Manual Reconnect");
			this.#socket = null;
		}

		this.#retryCount = 0;
		this.#connect();
	}

	// compatibility with older ReconnectingWebSocket class
	refresh() {
		this.reconnect();
	}

	close(code = 1000, reason) {
		this.#forcedClose = true;
		this.#clearInternalTimers();

		if (this.#socket) {
			this.#removeSocketListeners(this.#socket);
			this.#socket.close(code, reason);
			this.#socket = null;
		}

		window.removeEventListener("online", this.#onOnlineBound);
		window.removeEventListener("offline", this.#onOfflineBound);

		this.dispatchEvent(new CloseEvent("close", { code, reason, wasClean: true }));
	}

	#connect() {
		if (this.#forcedClose) return;

		if (!navigator.onLine) return;

		if (this.#socket && this.#socket.readyState === ReconnectingWebSocket.CONNECTING) return;

		try {
			const ws = new WebSocket(this.#url, this.#protocols);
			this.#socket = ws;
			ws.binaryType = this.#binaryType;

			ws.onopen = (event) => this.#handleOpen(event);
			ws.onclose = (event) => this.#handleClose(event);
			ws.onmessage = (event) => this.#handleMessage(event);
			ws.onerror = (event) => this.#handleError(event);

			this.#connectionTimeoutTimer = setTimeout(() => {
				if (this.#socket === ws) {
					this.#removeSocketListeners(ws);
					ws.close();
					this.#handleClose({
						target: ws,
						code: 4008,
						reason: "Connection Timeout",
						wasClean: false
					});
				}
			}, this.connectionTimeout);

		} catch (e) {
			if (e instanceof SyntaxError) {
				this.close(1006, "Fatal Syntax Error");
				this.dispatchEvent(new Event("error"));
				return;
			}
			this.#handleConnectionFailure();
		}
	}

	#handleWindowOnline() {
		if (this.#reconnectTimer) {
			clearTimeout(this.#reconnectTimer);
			this.#reconnectTimer = null;
			this.#retryCount = 0;
			this.#connect();
		}
		else if (!this.#socket || this.#socket.readyState === ReconnectingWebSocket.CLOSED) {
			this.#retryCount = 0;
			this.#connect();
		}
	}

	#handleOpen(event) {
		if (event.target !== this.#socket) return;
		clearTimeout(this.#connectionTimeoutTimer);
		this.#retryCount = 0;
		this.dispatchEvent(new Event("open"));
	}

	#handleMessage(event) {
		if (event.target !== this.#socket) return;
		this.dispatchEvent(new MessageEvent("message", {
			data: event.data,
			lastEventId: event.lastEventId,
			origin: event.origin,
			ports: event.ports,
			source: event.source
		}));
	}

	#handleClose(event) {
		if (event.target !== this.#socket) return;
		clearTimeout(this.#connectionTimeoutTimer);
		this.#socket = null;
		this.dispatchEvent(new CloseEvent("close", {
			code: event.code,
			reason: event.reason,
			wasClean: event.wasClean
		}));
		if (!this.#forcedClose) {
			this.#handleConnectionFailure();
		}
	}

	#handleError(event) {
		if (event.target !== this.#socket) return;
		this.dispatchEvent(new Event("error"));
	}

	#handleConnectionFailure() {
		if (this.#retryCount >= this.maxReconnectAttempts) {
			this.dispatchEvent(new Event("maxreconnects"));
			return;
		}
		let delay = this.baseReconnectInterval * Math.pow(this.reconnectDecay, this.#retryCount);
		delay = Math.min(delay, this.maxReconnectInterval);
		if (this.jitterFactor > 0) {
			const variance = delay * this.jitterFactor;
			const jitter = (Math.random() * variance * 2) - variance;
			delay = Math.max(0, delay + jitter);
		}
		this.#reconnectTimer = setTimeout(() => {
			this.#retryCount++;
			this.#connect();
		}, delay);
	}

	#clearInternalTimers() {
		if (this.#reconnectTimer) {
			clearTimeout(this.#reconnectTimer);
			this.#reconnectTimer = null;
		}
		if (this.#connectionTimeoutTimer) {
			clearTimeout(this.#connectionTimeoutTimer);
			this.#connectionTimeoutTimer = null;
		}
	}

	#removeSocketListeners(ws) {
		if (!ws) return;
		ws.onopen = null;
		ws.onclose = null;
		ws.onmessage = null;
		ws.onerror = null;
	}
}

export { ReconnectingWebSocket };
