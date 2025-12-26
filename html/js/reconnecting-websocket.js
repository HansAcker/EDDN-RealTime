/**
 * A wrapper around the standard WebSocket API that handles automatic reconnection
 * with an exponential backoff algorithm.
 *
 * It extends EventTarget, allowing standard usage of addEventListener() and
 * removeEventListener(), while also providing standard "on[event]" property setters.
 *
 * Public Configuration Options (set these directly on the instance):
 * - maxReconnectAttempts (number): Maximum number of retries before giving up. Default: Infinity.
 * - baseReconnectInterval (number): Initial delay in ms before the first retry. Default: 1000.
 * - maxReconnectInterval (number): Maximum delay in ms between retries. Default: 30000.
 * - reconnectDecay (number): The rate of increase for the delay (exponential backoff). Default: 1.5.
 * - jitterFactor (number): Randomization factor (0-1) to prevent thundering herd. Default: 0.2.
 * - connectionTimeout (number): Maximum time in ms to wait for a connection to open before failing and retrying. Default: 4000.
 * - maxBufferedMessages (number): Maximum number of messages to queue while disconnected. Default: 50.
 *
 * @extends EventTarget
 */
class ReconnectingWebSocket extends EventTarget {
	// Standard WebSocket constants exposed on the class
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
	 * Helps fail fast on hanging connections (e.g. firewalls dropping packets).
	 * @type {number}
	 * @default 4000
	 */
	connectionTimeout = 4000;

	/**
	 * Maximum number of messages to queue when offline.
	 * Oldest messages are dropped if limit is exceeded.
	 * @type {number}
	 * @default 50
	 */
	maxBufferedMessages = 50;

	// Internal State
	#url;
	#protocols;
	#socket = null;
	#retryCount = 0;
	#forcedClose = false;
	#reconnectTimer = null;
	#connectionTimeoutTimer = null;
	#binaryType = "blob";
	#messageQueue = [];

	// Map to store "onX" handler functions for property setters
	#onEventHandlers = new Map();

	// Bound handlers for listener management (stored to allow explicit removal)
	#onOnlineBound;
	#onOfflineBound;

	/**
	 * Creates a new ReconnectingWebSocket.
	 *
	 * @param {string|URL} url - The URL to connect to.
	 * @param {string|string[]} [protocols] - Either a single protocol string or an array of protocol strings.
	 * @param {object} [options] - Configuration options to overwrite defaults.
	 * @param {AbortSignal} [options.signal] - An optional AbortSignal to close and clean up the socket.
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
		// We use a hybrid approach:
		// 1. WeakRef ensures that if the user forgets to call close(), the global listener
		//    won't keep this instance alive forever (preventing memory leaks).
		// 2. We also store bound functions so close() can explicitly remove the listeners,
		//    ensuring immediate cleanup without waiting for GC.
		if (typeof window !== "undefined") {
			const weakRef = new WeakRef(this);

			this.#onOnlineBound = () => {
				const instance = weakRef.deref();
				if (instance) {
					instance.#handleWindowOnline();
				}
				// If instance is gone, the listener is effectively dead until GC or manual cleanup.
			};

			this.#onOfflineBound = () => {}; // No-op, present for symmetry and potential future use.

			window.addEventListener("online", this.#onOnlineBound);
			window.addEventListener("offline", this.#onOfflineBound);
		}

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
	 * Masquerades as CONNECTING (0) during the wait period between retries.
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
	 * Returns the number of bytes of data that have been queued using calls to send()
	 * but not yet transmitted to the network.
	 *
	 * NOTE: Unlike standard WebSocket, this implementation ONLY reports the buffer
	 * of the underlying active socket. It DOES NOT include the size of the offline
	 * message queue, as calculating exact byte size for mixed data types is expensive.
	 *
	 * @returns {number}
	 */
	get bufferedAmount() {
		return this.#socket?.bufferedAmount || 0;
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

	// Property setters to mimic standard WebSocket API
	/** @param {function} cb */
	set onopen(cb) { this.#updateEventHandler("open", cb); }
	/** @param {function} cb */
	set onmessage(cb) { this.#updateEventHandler("message", cb); }
	/** @param {function} cb */
	set onclose(cb) { this.#updateEventHandler("close", cb); }
	/** @param {function} cb */
	set onerror(cb) { this.#updateEventHandler("error", cb); }

	// =========================================================================
	// Public Methods
	// =========================================================================

	/**
	 * Enqueues the specified data to be transmitted to the server.
	 * If the socket is not open, the message is buffered (up to maxBufferedMessages).
	 *
	 * @param {string|ArrayBuffer|Blob|ArrayBufferView} data - The data to send.
	 * @throws {DOMException} If the WebSocket has been explicitly closed (InvalidStateError).
	 */
	send(data) {
		if (this.#forcedClose) {
			throw new DOMException("WebSocket is explicitly closed.", "InvalidStateError");
		}

		if (this.#socket && this.#socket.readyState === ReconnectingWebSocket.OPEN) {
			try {
				this.#socket.send(data);
			} catch (error) {
				// If the socket is theoretically OPEN but send() fails (e.g. network stack error),
				// we catch it and queue the message to prevent data loss.
				console.warn("ReconnectingWebSocket: Send failed, queuing message.", error);
				this.#queueMessage(data);
			}
		} else {
			this.#queueMessage(data);
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

		this.#retryCount = 0;

		if (this.#socket) {
			this.#removeSocketListeners(this.#socket);
			// Force close. No events will fire because listeners are removed.
			this.#socket.close(1000, "Manual Reconnect");
			this.#socket = null;
		}

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
		this.#messageQueue = [];

		if (this.#socket) {
			this.#removeSocketListeners(this.#socket);
			this.#socket.close(code, reason);
			this.#socket = null;
		}

		// Explicit cleanup of global listeners.
		// This prevents "dead" instances from lingering in memory if the GC is lazy.
		if (typeof window !== "undefined") {
			window.removeEventListener("online", this.#onOnlineBound);
			window.removeEventListener("offline", this.#onOfflineBound);
		}

		this.dispatchEvent(new CloseEvent("close", { code, reason, wasClean: true }));
	}

	// =========================================================================
	// Internal Logic
	// =========================================================================

	/** @private */
	#connect() {
		if (this.#forcedClose) return;

		// If we are offline, do not attempt to connect (save resources).
		if (typeof navigator !== "undefined" && !navigator.onLine) {
			return;
		}

		// Prevent multiple simultaneous connection attempts.
		if (this.#socket && this.#socket.readyState === ReconnectingWebSocket.CONNECTING) return;

		try {
			// Local reference ensures thread safety if #socket changes rapidly.
			const ws = new WebSocket(this.#url, this.#protocols);
			this.#socket = ws;
			ws.binaryType = this.#binaryType;

			ws.onopen = (event) => this.#handleOpen(event);
			ws.onclose = (event) => this.#handleClose(event);
			ws.onmessage = (event) => this.#handleMessage(event);
			ws.onerror = (event) => this.#handleError(event);

			// "Fail Fast" timeout:
			// If the socket doesn't open within connectionTimeout, we assume it's hanging
			// (e.g. firewall dropping packets silently) and force a close/retry cycle.
			this.#connectionTimeoutTimer = setTimeout(() => {
				if (this.#socket === ws) {
					ws.close(); // Triggers handleClose -> retry
				}
			}, this.connectionTimeout);

		} catch (e) {
			this.#handleConnectionFailure();
		}
	}

	/** @private */
	#handleWindowOnline() {
		// Immediately attempt to reconnect if we are currently disconnected.
		if (!this.#socket || this.#socket.readyState === WebSocket.CLOSED) {
			this.#retryCount = 0;
			this.#connect();
		}
	}

	/** @private */
	#handleOpen(event) {
		if (event.target !== this.#socket) return;

		clearTimeout(this.#connectionTimeoutTimer);
		this.#retryCount = 0;

		// Flush offline buffer before dispatching open so consumer receives messages in order.
		this.#flushMessageQueue();
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

		// Exponential Backoff
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
	#queueMessage(data) {
		this.#messageQueue.push(data);
		while (this.#messageQueue.length > this.maxBufferedMessages) {
			this.#messageQueue.shift();
			console.warn("ReconnectingWebSocket: Buffer full, dropping oldest message.");
		}
	}

	/** @private */
	#flushMessageQueue() {
		while (this.#messageQueue.length > 0 && this.#socket?.readyState === ReconnectingWebSocket.OPEN) {
			const data = this.#messageQueue.shift();
			try {
				this.#socket.send(data);
			} catch (e) {
				// If send fails immediately (rare but possible), put it back and stop flushing.
				this.#messageQueue.unshift(data);
				break;
			}
		}
	}

	/** @private */
	#updateEventHandler(type, callback) {
		if (this.#onEventHandlers.has(type)) {
			this.removeEventListener(type, this.#onEventHandlers.get(type));
		}
		if (typeof callback === "function") {
			this.#onEventHandlers.set(type, callback);
			this.addEventListener(type, callback);
		} else {
			this.#onEventHandlers.delete(type);
		}
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
