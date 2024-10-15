// TODO: rename everything


class Activity {
	// TODO: does it make sense to use Symbol like this instead of just strings? or numbers?
	static _states = {
		_ok: Symbol("ok"),
		_off: Symbol("off"),
		_idle: Symbol("idle"),
		_error: Symbol("error")
	};

	#idleTimeout;
	#idleTimer = null;
	#lastState = Activity._states._off;

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

	off = this.#set.bind(this, Activity._states._off, 0);
	idle = this.#set.bind(this, Activity._states._idle, 0);
	error = this.#set.bind(this, Activity._states._error, 0);
	ok = (timeout = this.#idleTimeout) => this.#set(Activity._states._ok, timeout);
}


// changes the href attribute of an object, typically a <link rel=icon> elememt
class PageIconActivity extends Activity {
	static #icons = {
		[Activity._states._ok]: "img/activity-icon/activity-icon--state-ok.svg",
		[Activity._states._off]: "img/activity-icon/activity-icon--state-off.svg",
		[Activity._states._idle]: "img/activity-icon/activity-icon--state-idle.svg",
		[Activity._states._error]: "img/activity-icon/activity-icon--state-error.svg"
	};

	_changeState(newState, oldState) {
		this._element.href = PageIconActivity.#icons[newState];
	}
}


// adds/removes CSS classes
class ClassActivity extends Activity {
	static #classes = {
		[Activity._states._ok]: "activity-icon--state-ok",
		[Activity._states._off]: "activity-icon--state-off",
		[Activity._states._idle]: "activity-icon--state-idle",
		[Activity._states._error]: "activity-icon--state-error"
	};

	_changeState(newState, oldState) {
		this._element.classList.remove(ClassActivity.#classes[oldState]);
		this._element.classList.add(ClassActivity.#classes[newState]);
	}
}

export { PageIconActivity, ClassActivity };
