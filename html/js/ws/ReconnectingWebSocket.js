/**
 * @module ReconnectingWebSocket
 * @description WebSocket wrapper that automatically reconnects on connection
 * failures using exponential back-off with jitter. Implements the same interface
 * as the native {@link WebSocket} class while extending {@link EventTarget}.
 */

/**
 * A WebSocket wrapper that automatically reconnects on connection failures
 * using exponential back-off with jitter. Implements the same interface as
 * the native {@link WebSocket} class while extending {@link EventTarget}.
 *
 * @extends EventTarget
 */
class ReconnectingWebSocket extends EventTarget {
	static CONNECTING = WebSocket.CONNECTING;
	static OPEN = WebSocket.OPEN;
	static CLOSING = WebSocket.CLOSING;
	static CLOSED = WebSocket.CLOSED;

	/** @type {number} Maximum number of consecutive reconnection attempts. */
	maxReconnectAttempts = Infinity;
	/** @type {number} Initial reconnect delay in milliseconds. */
	baseReconnectInterval = 1200;
	/** @type {number} Upper bound for the reconnect delay in milliseconds. */
	maxReconnectInterval = 30000;
	/** @type {number} Exponential multiplier applied per retry. */
	reconnectDecay = 1.3;
	/** @type {number} Random jitter factor (0–1) applied to the delay. */
	jitterFactor = 0.3;
	/** @type {number} Milliseconds before a pending connection attempt is aborted. */
	connectionTimeout = 4000;

	// automatically close the socket when used with `using`
	[Symbol.dispose] = () => this.close();

	#url;
	#protocols;
	#socket = null;
	#retryCount = 0;
	#forcedClose = false;
	#reconnectTimer = null;
	#connectionTimeoutTimer = null;
	#binaryType = "blob";

	#handlers = new Map();

	#onOnlineBound;
	#onOfflineBound;

	/**
	 * Creates a new ReconnectingWebSocket and immediately begins connecting.
	 *
	 * @param {string} url - The WebSocket URL to connect to.
	 * @param {string|string[]} [protocols=[]] - Sub-protocols to request.
	 * @param {object} [options={}] - Additional options.
	 * @param {AbortSignal} [options.signal] - An AbortSignal that, when aborted, permanently closes the socket.
	 * @param {number} [options.maxReconnectAttempts] - Maximum number of consecutive reconnection attempts.
	 * @param {number} [options.baseReconnectInterval] - Initial reconnect delay in milliseconds.
	 * @param {number} [options.maxReconnectInterval] - Upper bound for the reconnect delay in milliseconds.
	 * @param {number} [options.reconnectDecay] - Exponential multiplier applied per retry.
	 * @param {number} [options.jitterFactor] - Random jitter factor (0–1) applied to the delay.
	 * @param {number} [options.connectionTimeout] - Milliseconds before a pending connection attempt is aborted.
	 */
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

	/**
	 * The sub-protocol selected by the server, or an empty string.
	 *
	 * @returns {string}
	 */
	get protocol() {
		return this.#socket?.protocol || "";
	}

	/**
	 * The current connection state, mirroring the WebSocket `readyState` constants.
	 *
	 * @returns {number}
	 */
	get readyState() {
		if (this.#socket) {
			return this.#socket.readyState;
		}
		return this.#forcedClose ? ReconnectingWebSocket.CLOSED : ReconnectingWebSocket.CONNECTING;
	}

	/**
	 * The WebSocket URL.
	 *
	 * @returns {string}
	 */
	get url() {
		return this.#url;
	}

	/**
	 * The binary data type for received messages.
	 *
	 * @returns {BinaryType}
	 */
	get binaryType() {
		return this.#binaryType;
	}

	/**
	 * Sets the binary data type and propagates it to the underlying socket.
	 *
	 * @param {BinaryType} value - The binary type (`"blob"` or `"arraybuffer"`).
	 */
	set binaryType(value) {
		this.#binaryType = value;
		if (this.#socket) {
			this.#socket.binaryType = value;
		}
	}

	/**
	 * Sets the event handler for the 'open' event.
	 * @param {Function|null} cb - The event handler function or null to remove.
	 */
	set onopen(cb) { this.#updateHandler("open", cb); }

	/**
	 * Gets the current event handler for the 'open' event.
	 * @returns {Function|null} The event handler function or null if none.
	 */
	get onopen() { return this.#handlers.get("open") ?? null; }

	/**
	 * Sets the event handler for the 'message' event.
	 * @param {Function|null} cb - The event handler function or null to remove.
	 */
	set onmessage(cb) { this.#updateHandler("message", cb); }

	/**
	 * Gets the current event handler for the 'message' event.
	 * @returns {Function|null} The event handler function or null if none.
	 */
	get onmessage() { return this.#handlers.get("message") ?? null; }

	/**
	 * Sets the event handler for the 'close' event.
	 * @param {Function|null} cb - The event handler function or null to remove.
	 */
	set onclose(cb) { this.#updateHandler("close", cb); }

	/**
	 * Gets the current event handler for the 'close' event.
	 * @returns {Function|null} The event handler function or null if none.
	 */
	get onclose() { return this.#handlers.get("close") ?? null; }

	/**
	 * Sets the event handler for the 'error' event.
	 * @param {Function|null} cb - The event handler function or null to remove.
	 */
	set onerror(cb) { this.#updateHandler("error", cb); }

	/**
	 * Gets the current event handler for the 'error' event.
	 * @returns {Function|null} The event handler function or null if none.
	 */
	get onerror() { return this.#handlers.get("error") ?? null; }

	/**
	 * Replaces an `on<event>` handler, removing the previous one if set.
	 *
	 * @param {string} type - The event type (e.g. `"open"`, `"message"`).
	 * @param {Function|null} newHandler - The new handler function, or `null` to remove.
	 */
	#updateHandler(type, newHandler) {
		const currentHandler = this.#handlers.get(type);
		if (currentHandler) {
			this.removeEventListener(type, currentHandler);
		}
		if (newHandler === null) {
			this.#handlers.delete(type);
		} else {
			this.#handlers.set(type, newHandler);
			if (typeof newHandler === "function") {
				this.addEventListener(type, newHandler);
			}
		}
	}

	/**
	 * Sends data through the underlying WebSocket.
	 *
	 * @param {string|ArrayBuffer|Blob} data - The data to send.
	 * @throws {DOMException} If the socket is not currently open.
	 */
	send(data) {
		if (this.#socket && this.#socket.readyState === ReconnectingWebSocket.OPEN) {
			this.#socket.send(data);
		} else {
			throw new DOMException("WebSocket is not open. Wait for 'open' event.", "InvalidStateError");
		}
	}

	/**
	 * Forces a reconnection by closing the current socket, resetting the
	 * retry counter, and opening a fresh connection.
	 *
	 * @throws {DOMException} If the socket has been permanently closed.
	 */
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

	/**
	 * Alias for {@link ReconnectingWebSocket#reconnect} retained for
	 * backwards compatibility.
	 */
	// compatibility with older ReconnectingWebSocket class
	refresh() {
		this.reconnect();
	}

	/**
	 * Permanently closes the WebSocket and prevents further reconnection
	 * attempts.
	 *
	 * @param {number} [code=1000] - The WebSocket close code.
	 * @param {string} [reason] - A human-readable close reason.
	 */
	close(code = 1000, reason) {
		this.#forcedClose = true;
		this.#clearInternalTimers();

		for (const [type, handler] of this.#handlers) {
			this.removeEventListener(type, handler);
		}
		this.#handlers.clear();

		if (this.#socket) {
			this.#removeSocketListeners(this.#socket);
			this.#socket.close(code, reason);
			this.#socket = null;
		}

		window.removeEventListener("online", this.#onOnlineBound);
		window.removeEventListener("offline", this.#onOfflineBound);

		this.dispatchEvent(new CloseEvent("close", { code, reason, wasClean: true }));
	}

	/**
	 * Creates a new native WebSocket connection unless one is already pending
	 * or the socket has been permanently closed.
	 */
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

		} catch (err) {
			if (err instanceof SyntaxError) {
				this.close(1006, "Fatal Syntax Error");
				this.dispatchEvent(new Event("error"));
				return;
			}
			this.#handleConnectionFailure();
		}
	}

	/**
	 * Called when the browser goes online; triggers an immediate reconnection
	 * if one was pending or the socket is closed.
	 */
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

	/**
	 * Handles the underlying WebSocket `open` event.
	 *
	 * @param {Event} event - The open event.
	 */
	#handleOpen(event) {
		if (event.target !== this.#socket) return;
		clearTimeout(this.#connectionTimeoutTimer);
		this.#retryCount = 0;
		this.dispatchEvent(new Event("open"));
	}

	/**
	 * Handles the underlying WebSocket `message` event by re-dispatching it.
	 *
	 * @param {MessageEvent} event - The message event.
	 */
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

	/**
	 * Handles the underlying WebSocket `close` event, dispatches it, and
	 * schedules a reconnection unless the close was forced.
	 *
	 * @param {CloseEvent} event - The close event.
	 */
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

	/**
	 * Handles the underlying WebSocket `error` event by re-dispatching it.
	 *
	 * @param {Event} event - The error event.
	 */
	#handleError(event) {
		if (event.target !== this.#socket) return;
		this.dispatchEvent(new Event("error"));
	}

	/**
	 * Schedules a reconnection attempt with exponential back-off and jitter.
	 * Dispatches a `maxreconnects` event if the retry limit has been reached.
	 */
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

	/**
	 * Clears the reconnect and connection-timeout timers.
	 */
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

	/**
	 * Detaches all `on*` handlers from a native WebSocket instance.
	 *
	 * @param {WebSocket|null} ws - The WebSocket to clean up.
	 */
	#removeSocketListeners(ws) {
		if (!ws) return;
		ws.onopen = null;
		ws.onclose = null;
		ws.onmessage = null;
		ws.onerror = null;
	}
}

export { ReconnectingWebSocket };
