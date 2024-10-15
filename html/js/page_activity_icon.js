// changes the href attribute of an object, typically a <link rel=icon> elememt

class PageActivityIcon {
	// TODO: does it make sense to use Symbol like this instead of just strings? or numbers?
	static #states = {
		ok: Symbol("ok"),
		off: Symbol("off"),
		idle: Symbol("idle"),
		error: Symbol("error")
	};

	// can't use CSS to style the page icon href
	// TODO: move to configuration block
	static #icons = {
		[PageActivityIcon.#states.ok]: "img/led/led-circle-green.svg",
		[PageActivityIcon.#states.off]: "img/led/led-circle-red.svg",
		[PageActivityIcon.#states.idle]: "img/led/led-circle-grey.svg",
		[PageActivityIcon.#states.error]: "img/led/led-circle-yellow.svg"
	};

	#icon;
	#idleTimeout;
	#idleTimer = null;
	#lastState = PageActivityIcon.#states.off;

	constructor(icon, idleTimeout = 0) {
		this.#icon = icon;
		this.#idleTimeout = idleTimeout;
	}

	// TODO: clears/sets timeouts with every update. use fixed loop?
	#set(state, timeout = 0) {
		if (this.#idleTimer) {
			clearTimeout(this.#idleTimer);
			this.#idleTimer = null;
		}

		if (this.#lastState != state) {
			// console.log(`${this.#lastState.toString()} => ${state.toString()}`);
			this.#icon.href = PageActivityIcon.#icons[state];
			this.#lastState = state;
		}

		if (timeout) {
			this.#idleTimer = setTimeout(this.idle, timeout);
		}
	}

	off = this.#set.bind(this, PageActivityIcon.#states.off, 0);
	idle = this.#set.bind(this, PageActivityIcon.#states.idle, 0);
	error = this.#set.bind(this, PageActivityIcon.#states.error, 0);

	ok(timeout = this.#idleTimeout) {
		this.#set(PageActivityIcon.#states.ok, timeout);
	}
}

export { PageActivityIcon };
