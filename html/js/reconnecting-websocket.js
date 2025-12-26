/**
 * High-Performance Reconnecting WebSocket (Browser Exclusive)
 *
 * A wrapper around the standard WebSocket API that handles automatic reconnection
 * with an exponential backoff algorithm.
 *
 * Design Philosophy:
 * - Read-Optimized: Focuses on maintaining a persistent connection for receiving data.
 * - No Offline Buffer: Calls to send() throw immediately if disconnected. The application
 * is responsible for queueing or handling state when the network is down.
 * - Browser Exclusive: Hard-coded dependency on `window`, `navigator`, and `WebSocket`.
 * Do not use in Node.js or Service Worker environments.
 *
 * Public Configuration Options (set these directly on the instance):
 * - maxReconnectAttempts (number): Maximum retries before giving up. Default: Infinity.
 * - baseReconnectInterval (number): Initial delay in ms before first retry. Default: 1000.
 * - maxReconnectInterval (number): Maximum delay in ms between retries. Default: 30000.
 * - reconnectDecay (number): Rate of increase for the delay (exponential backoff). Default: 1.5.
 * - jitterFactor (number): Randomization factor (0-1) to prevent thundering herd. Default: 0.2.
 * - connectionTimeout (number): Max time to wait for a connection before failing. Default: 4000.
 *
 * @extends EventTarget
 */
class ReconnectingWebSocket extends EventTarget {
	// Standard WebSocket constants exposed on the class.
	// explicit dependency on the global WebSocket object.
	static CONNECTING = WebSocket.CONNECTING;
	static OPEN = WebSocket.OPEN;
	static CLOSING = WebSocket.CLOSING;
	static CLOSED = WebSocket.CLOSED;

	/**
	 * Maximum number of retries before giving up.
	 * @type {number}
	 * @default Infinity
	 */
	maxReconnectAttempts = Infinity;

	/**
	 * Initial delay in ms before the first retry.
	 * @type {number}
	 * @default 1000
	 */
	baseReconnectInterval = 1000;

	/**
	 * Maximum delay in ms between retries.
	 * @type {number}
	 * @default 30000
	 */
	maxReconnectInterval = 30000;

	/**
	 * The rate of increase for the delay.
	 * @type {number}
	 * @default 1.5
	 */
	reconnectDecay = 1.5;

	/**
	 * Randomization factor (0-1) to apply to the backoff delay.
	 * Helps prevent thundering herd when many clients reconnect simultaneously.
	 * @type {number}
	 * @default 0.2
	 */
	jitterFactor = 0.2;

	/**
	 * Maximum time in ms to wait for a connection to open before closing and retrying.
	 * Helps fail fast on hanging connections (e.g. firewalls dropping packets without FIN).
	 * @type {number}
	 * @default 4000
	 */
	connectionTimeout = 4000;

	// Internal State
	#url;
	#protocols;
	#socket = null;
	#retryCount = 0;
	#forcedClose = false;
	#reconnectTimer = null;
	#connectionTimeoutTimer = null;
	#binaryType = "blob";

	// Event Handler Backing Fields
	#onopen = null;
	#onmessage = null;
	#onclose = null;
	#onerror = null;

	// Bound handlers for listener management (stored to allow explicit removal)
	#onOnlineBound;
	#onOfflineBound;

	/**
	 * Creates a new ReconnectingWebSocket.
	 *
	 * @param {string|URL} url - The URL to connect to.
	 * @param {string|string[]} [protocols] - Protocol string or array of protocol strings.
	 * @param {object} [options] - Configuration options to overwrite defaults.
	 * @param {AbortSignal} [options.signal] - An optional AbortSignal to close the socket.
	 */
	constructor(url, protocols = [], options = {}) {
		super();
		this.#url = url;
		this.#protocols = protocols;

		// Extract signal from options to avoid assigning it to 'this'
		const { signal, ...config } = options;
		Object.assign(this, config);

		if (signal) {
			signal.addEventListener("abort", () => this.close());
		}

		// Handle browser offline/online state.
		// We bind these immediately to the window.
		this.#onOnlineBound = () => this.#handleWindowOnline();
		this.#onOfflineBound = () => {}; // No-op, present for symmetry and explicit cleanup.

		window.addEventListener("online", this.#onOnlineBound);
		window.addEventListener("offline", this.#onOfflineBound);

		this.#connect();
	}

	// =========================================================================
	// Standard WebSocket API Compatibility
	// =========================================================================

	/**
	 * Returns the name of the sub-protocol the server selected.
	 * @returns {string}
	 */
	get protocol() {
		return this.#socket?.protocol || "";
	}

	/**
	 * The current state of the connection.
	 * Masquerades as CONNECTING (0) during the wait period between retries to
	 * prevent consumers from thinking the socket is dead when it is just recovering.
	 * @returns {number} 0 (CONNECTING), 1 (OPEN), 2 (CLOSING), or 3 (CLOSED).
	 */
	get readyState() {
		if (this.#socket) {
			return this.#socket.readyState;
		}
		return this.#forcedClose ? ReconnectingWebSocket.CLOSED : ReconnectingWebSocket.CONNECTING;
	}

	/**
	 * The URL of the WebSocket.
	 * @returns {string|URL}
	 */
	get url() {
		return this.#url;
	}

	/**
	 * The type of binary data being transmitted.
	 * @returns {string} "blob" or "arraybuffer".
	 */
	get binaryType() {
		return this.#binaryType;
	}

	/**
	 * Sets the type of binary data being transmitted.
	 * Persists across reconnections.
	 * @param {string} value - "blob" or "arraybuffer".
	 */
	set binaryType(value) {
		this.#binaryType = value;
		if (this.#socket) {
			this.#socket.binaryType = value;
		}
	}

	// =========================================================================
	// Event Handler Properties (onopen, onmessage, etc.)
	// =========================================================================

	/** @param {function} cb */
	set onopen(cb) { this.#updateHandler("open", cb); }
	get onopen() { return this.#onopen; }

	/** @param {function} cb */
	set onmessage(cb) { this.#updateHandler("message", cb); }
	get onmessage() { return this.#onmessage; }

	/** @param {function} cb */
	set onclose(cb) { this.#updateHandler("close", cb); }
	get onclose() { return this.#onclose; }

	/** @param {function} cb */
	set onerror(cb) { this.#updateHandler("error", cb); }
	get onerror() { return this.#onerror; }

	/**
	 * Helper to swap event handlers without memory leaks or Map lookups.
	 * @private
	 * @param {string} type - The event name (e.g., "open").
	 * @param {function} newHandler - The new callback function.
	 */
	#updateHandler(type, newHandler) {
		const propName = `#on${type}`;
		// Remove previous listener if one existed to prevent duplicates
		if (this[propName]) {
			this.removeEventListener(type, this[propName]);
		}
		this[propName] = newHandler;
		if (typeof newHandler === "function") {
			this.addEventListener(type, newHandler);
		}
	}

	// =========================================================================
	// Public Methods
	// =========================================================================

	/**
	 * Transmits data to the server.
	 *
	 * @param {string|ArrayBuffer|Blob|ArrayBufferView} data - The data to send.
	 * @throws {DOMException} "InvalidStateError" if the socket is not strictly OPEN.
	 */
	send(data) {
		if (this.#socket && this.#socket.readyState === ReconnectingWebSocket.OPEN) {
			this.#socket.send(data);
		} else {
			// Zero-tolerance policy: If it's not open, we crash the call.
			// This forces the consumer to handle their own queueing or state management.
			throw new DOMException("WebSocket is not open. Wait for 'open' event.", "InvalidStateError");
		}
	}

	/**
	 * Manually refreshes the connection.
	 * Closes the current internal socket (if open) and immediately opens a new one.
	 * Resets the retry backoff timer.
	 *
	 * @throws {DOMException} If the socket was previously permanently closed via close().
	 */
	reconnect() {
		if (this.#forcedClose) {
			throw new DOMException("Cannot reconnect a closed WebSocket.", "InvalidStateError");
		}

		console.debug("ReconnectingWebSocket: Manual reconnect requested.");

		if (this.#socket) {
			this.#removeSocketListeners(this.#socket);
			// 1000: Normal Closure. indicating that the purpose for which the connection was established has been fulfilled.
			this.#socket.close(1000, "Manual Reconnect");
			this.#socket = null;
		}

		this.#retryCount = 0;
		this.#connect();
	}

	/**
	 * Closes the WebSocket connection or connection attempt, if any.
	 * This is a permanent action. The socket will not auto-reconnect.
	 *
	 * @param {number} [code=1000]
	 * @param {string} [reason]
	 */
	close(code = 1000, reason) {
		this.#forcedClose = true;
		this.#clearInternalTimers();

		if (this.#socket) {
			this.#removeSocketListeners(this.#socket);
			this.#socket.close(code, reason);
			this.#socket = null;
		}

		// Explicit cleanup of global listeners.
		// This prevents "dead" instances from lingering in memory if the GC is lazy.
		window.removeEventListener("online", this.#onOnlineBound);
		window.removeEventListener("offline", this.#onOfflineBound);

		this.dispatchEvent(new CloseEvent("close", { code, reason, wasClean: true }));
	}

	// =========================================================================
	// Internal Logic
	// =========================================================================

	/** @private */
	#connect() {
		if (this.#forcedClose) return;

		// Save resources: Do not attempt to connect if the browser is offline.
		if (!navigator.onLine) return;

		// Prevent multiple simultaneous connection attempts.
		if (this.#socket && this.#socket.readyState === ReconnectingWebSocket.CONNECTING) return;

		try {
			const ws = new WebSocket(this.#url, this.#protocols);
			this.#socket = ws;
			ws.binaryType = this.#binaryType;

			// Attach standard event listeners
			ws.onopen = (event) => this.#handleOpen(event);
			ws.onclose = (event) => this.#handleClose(event);
			ws.onmessage = (event) => this.#handleMessage(event);
			ws.onerror = (event) => this.#handleError(event);

			// "Fail Fast" timeout:
			// If the socket doesn't open within connectionTimeout, we assume it's hanging
			// (e.g. firewall dropping packets silently) and force a close/retry cycle.
			this.#connectionTimeoutTimer = setTimeout(() => {
				if (this.#socket === ws) {
					// 1. "Disown" the socket immediately to prevent "Phantom Opens".
					// This prevents ANY events from this instance triggering methods on our class.
					this.#removeSocketListeners(ws);

					// 2. Kill the socket at the network level.
					ws.close();

					// 3. Manually trigger the cleanup/retry logic since we removed the listeners.
					this.#handleClose({
						target: ws,
						code: 4008,
						reason: "Connection Timeout",
						wasClean: false
					});
				}
			}, this.connectionTimeout);

		} catch (e) {
			this.#handleConnectionFailure();
		}
	}

	/** @private */
	#handleWindowOnline() {
		// Optimization: If we are in the middle of a backoff wait, interrupt it.
		// There is no point waiting 30s if the user just reconnected their wifi.
		if (this.#reconnectTimer) {
			clearTimeout(this.#reconnectTimer);
			this.#reconnectTimer = null;
			this.#retryCount = 0; // Reset backoff since we have a fresh signal
			this.#connect();
		}
		// Otherwise, if we are strictly closed (and not processing a connect), go now.
		else if (!this.#socket || this.#socket.readyState === ReconnectingWebSocket.CLOSED) {
			this.#retryCount = 0;
			this.#connect();
		}
	}

	/** @private */
	#handleOpen(event) {
		// Verify ownership to prevent race conditions from timed-out sockets
		if (event.target !== this.#socket) return;

		clearTimeout(this.#connectionTimeoutTimer);
		this.#retryCount = 0;

		// Critical Sequencing: Dispatch OPEN first.
		// This allows the consumer to immediately call send() in their listener.
		this.dispatchEvent(new Event("open"));
	}

	/** @private */
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

	/** @private */
	#handleClose(event) {
		// Verify this close event is from the current active socket.
		if (event.target !== this.#socket) return;

		clearTimeout(this.#connectionTimeoutTimer);
		this.#socket = null;

		// Dispatch 'close' so the consumer knows we are currently disconnected.
		this.dispatchEvent(new CloseEvent("close", {
			code: event.code,
			reason: event.reason,
			wasClean: event.wasClean
		}));

		if (!this.#forcedClose) {
			this.#handleConnectionFailure();
		}
	}

	/** @private */
	#handleError(event) {
		if (event.target !== this.#socket) return;
		this.dispatchEvent(new Event("error"));
	}

	/** @private */
	#handleConnectionFailure() {
		if (this.#retryCount >= this.maxReconnectAttempts) {
			this.dispatchEvent(new Event("maxreconnects"));
			return;
		}

		// Exponential Backoff Calculation
		let delay = this.baseReconnectInterval * Math.pow(this.reconnectDecay, this.#retryCount);
		delay = Math.min(delay, this.maxReconnectInterval);

		// Apply Jitter (randomization) to prevent "thundering herd"
		// where all clients retry at the exact same millisecond.
		if (this.jitterFactor > 0) {
			const variance = delay * this.jitterFactor;
			// Random value between [-variance, +variance]
			const jitter = (Math.random() * variance * 2) - variance;
			delay = Math.max(0, delay + jitter);
		}

		this.#reconnectTimer = setTimeout(() => {
			this.#retryCount++;
			this.#connect();
		}, delay);
	}

	/** @private */
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

	/** @private */
	#removeSocketListeners(ws) {
		if (!ws) return;
		ws.onopen = null;
		ws.onclose = null;
		ws.onmessage = null;
		ws.onerror = null;
	}
}

export { ReconnectingWebSocket };
