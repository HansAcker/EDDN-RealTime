// activity status icon

class ActivityIcon {
	// TODO: does it make sense to use Symbol like this instead of just strings?
	static #states = {
		ok: Symbol("ok"),
		off: Symbol("off"),
		idle: Symbol("idle"),
		error: Symbol("error")
	};

	// can't use CSS to style the page icon href
	// TODO: move to configuration block
	static #icons = {
		[ActivityIcon.#states.ok]: "img/led/led-circle-green.svg",
		[ActivityIcon.#states.off]: "img/led/led-circle-red.svg",
		[ActivityIcon.#states.idle]: "img/led/led-circle-grey.svg",
		[ActivityIcon.#states.error]: "img/led/led-circle-yellow.svg"
	};

	#icon;
	#idleTimeout;
	#idleTimer = null;
	#lastState = ActivityIcon.#states.off;

	constructor(icon, idleTimeout = 0) {
		this.#icon = icon;
		this.#idleTimeout = idleTimeout;
	}

	#set(state, timeout = 0) {
		if (this.#idleTimer) {
			clearTimeout(this.#idleTimer);
			this.#idleTimer = null;
		}

		if (this.#lastState != state) {
			// console.log(`${this.#lastState.toString()} => ${state.toString()}`);
			this.#icon.href = ActivityIcon.#icons[state];
			this.#lastState = state;
		}

		if (timeout) {
			this.#idleTimer = setTimeout(this.idle, timeout);
		}
	}

	off = this.#set.bind(this, ActivityIcon.#states.off, 0);
	idle = this.#set.bind(this, ActivityIcon.#states.idle, 0);
	error = this.#set.bind(this, ActivityIcon.#states.error, 0);

	ok(timeout = this.#idleTimeout) {
		this.#set(ActivityIcon.#states.ok, timeout);
	}
}

export { ActivityIcon };
