// TODO: rename everything


class Activity {
	// TODO: does it make sense to use Symbol like this instead of just strings? or numbers?
	static _states = {
		ok: Symbol("ok"),
		off: Symbol("off"),
		idle: Symbol("idle"),
		error: Symbol("error")
	};

	#idleTimeout;
	#idleTimer = null;
	#lastState = Activity._states.off;

	_element;

	constructor(element, idleTimeout = 0) {
		this._element = element;
		this.#idleTimeout = idleTimeout;
	}

	_changeState(newState, oldState) {
		// base class does nothing here
	}

	// TODO: clears/sets timeouts with every update. use fixed loop?
	#set(state, timeout = 0) {
		if (this.#idleTimer) {
			clearTimeout(this.#idleTimer);
			this.#idleTimer = null;
		}

		if (this.#lastState != state) {
			// console.log(`${this.#lastState.toString()} => ${state.toString()}`);
			this._changeState(state, this.#lastState);
			this.#lastState = state;
		}

		if (timeout) {
			this.#idleTimer = setTimeout(this.idle, timeout);
		}
	}

	off = this.#set.bind(this, Activity._states.off, 0);
	idle = this.#set.bind(this, Activity._states.idle, 0);
	error = this.#set.bind(this, Activity._states.error, 0);

	ok(timeout = this.#idleTimeout) {
		this.#set(Activity._states.ok, timeout);
	}
}


// changes the href attribute of an object, typically a <link rel=icon> elememt
class PageIconActivity extends Activity {
	// can't use CSS to style the page icon href
	// TODO: move to configuration block
	static #icons = {
		[Activity._states.ok]: "img/led/led-circle-green.svg",
		[Activity._states.off]: "img/led/led-circle-red.svg",
		[Activity._states.idle]: "img/led/led-circle-grey.svg",
		[Activity._states.error]: "img/led/led-circle-yellow.svg"
	};

	_changeState(newState, oldState) {
		this._element.href = PageIconActivity.#icons[newState];
	}
}


// adds/removes CSS classes
class ClassActivity extends Activity {
	static #classes = {
		[Activity._states.ok]: "activity-icon--state-ok",
		[Activity._states.off]: "activity-icon--state-off",
		[Activity._states.idle]: "activity-icon--state-idle",
		[Activity._states.error]: "activity-icon--state-error"
	};

	_changeState(newState, oldState) {
		this._element.classList.remove(ClassActivity.#classes[oldState]);
		this._element.classList.add(ClassActivity.#classes[newState]);
	}
}

export { PageIconActivity, ClassActivity };
