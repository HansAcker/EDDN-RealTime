// TODO: rename everything


// activity status
// changes from ok to idle after idleTimeout, all other states use no timer

class Activity {
	static _states = Object.freeze({
		_ok: Symbol("ok"),
		_off: Symbol("off"),
		_idle: Symbol("idle"),
		_error: Symbol("error")
	});

	#idleTimeout;
	#idleTimer = null;
	#lastState = Activity._states._off;

	_element;

	constructor(element, idleTimeout = 0) {
		this._element = element;
		this.#idleTimeout = idleTimeout;
	}

	_changeState(_newState, _oldState) {
		// base class does nothing here
	}

	// clears/sets timeouts with every update, should be cheap enough
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

	ok = () => this.#set(Activity._states._ok, this.#idleTimeout);
	off = () => this.#set(Activity._states._off, 0);
	idle = () => this.#set(Activity._states._idle, 0);
	error = () => this.#set(Activity._states._error, 0);
}


// changes the href attribute of an object, typically a <link rel=icon> element
// the browser is likely to request the file each time the state changes (favicon handler)
// TODO: same as IconActivity(attribute="href")
class PageIconActivity extends Activity {
	static #icons = {
		[Activity._states._ok]: "img/activity-icon/activity-icon--state-ok.svg",
		[Activity._states._off]: "img/activity-icon/activity-icon--state-off.svg",
		[Activity._states._idle]: "img/activity-icon/activity-icon--state-idle.svg",
		[Activity._states._error]: "img/activity-icon/activity-icon--state-error.svg"
	};

	_changeState(newState, _oldState) {
		this._element.href = PageIconActivity.#icons[newState];
	}
}


// pre-loads icons into "blob:" URLs
class CachedPageIconActivity extends PageIconActivity {
	static #cache = new Map(); // state -> blob
	static #readyPromise = null;  // `await CachedPageIconActivity.ready`

	constructor(element, idleTimeout) {
		super(element, idleTimeout);

		// start async fetches on first run
		void CachedPageIconActivity.ready;
	}

	_changeState(newState, oldState) {
		if (CachedPageIconActivity.#cache.has(newState)) {
			this._element.href = CachedPageIconActivity.#cache.get(newState);
		} else {
			console.debug(`CachedPageIconActivity: no cache for ${newState.toString()}`);
			super._changeState(newState, oldState);
		}
	}

	static get ready() {
		if (!CachedPageIconActivity.#readyPromise) {
			CachedPageIconActivity.#readyPromise = CachedPageIconActivity.#preloadIcons();
		}

		return CachedPageIconActivity.#readyPromise;
	}

	static async #preloadIcons() {
		// TODO: merge with PageIconActivity.#icons. use "_icons" instead of "#"?
		const ICON_PATHS = {
			[Activity._states._ok]: "img/activity-icon/activity-icon--state-ok.svg",
			[Activity._states._off]: "img/activity-icon/activity-icon--state-off.svg",
			[Activity._states._idle]: "img/activity-icon/activity-icon--state-idle.svg",
			[Activity._states._error]: "img/activity-icon/activity-icon--state-error.svg"
		};

		const loadPromises = Object.getOwnPropertySymbols(ICON_PATHS).map(async (state) => {
			const path = ICON_PATHS[state];
			try {
				console.debug("CachedPageIconActivity: loading activity icons...");
				const response = await fetch(path);

				if (!response.ok) {
					throw new Error(`HTTP ${response.status} ${response.statusText}`);
				}

				// TODO: check that response is SVG?

				// store response in blob storage, register blob: URL in map
				this.#cache.set(state, URL.createObjectURL(await response.blob()));
				console.debug(`CachedPageIconActivity: cached icon: ${path} for state: ${state.toString()}`);
			} catch (err) {
				console.warn(`CachedPageIconActivity: failed to preload icon: ${path} for state: ${state.toString()}:`, err);
			}
		});

		return Promise.allSettled(loadPromises);
	}
}


// adds/removes CSS classes

class CSSActivity extends Activity {
	static #classes = {
		[Activity._states._ok]: "activity-icon--state-ok",
		[Activity._states._off]: "activity-icon--state-off",
		[Activity._states._idle]: "activity-icon--state-idle",
		[Activity._states._error]: "activity-icon--state-error"
	};

	_changeState(newState, oldState) {
		this._element.classList.add(CSSActivity.#classes[newState]);
		this._element.classList.remove(CSSActivity.#classes[oldState]);
	}
}


/*

// unused WIP based on Activity class

// changes an object property

class AttributeActivity extends Activity {
	static #defaults = {
		[Activity._states._ok]: "ok",
		[Activity._states._off]: "off",
		[Activity._states._idle]: "idle",
		[Activity._states._error]: "error"
	};

	#attribute;
	#values;

	// TODO: due to property mangling, it's virtually impossible to provide an external values dict
	constructor(element, idleTimeout = 0, attribute = "textContent", values = AttributeActivity.#defaults) {
		super(element, idleTimeout);
		this.#attribute = attribute;
		this.#values = values;
	}

	_changeState(newState, oldState) {
		this._element[this.#attribute] = this.#values[newState];
	}
}


class IconActivity extends AttributeActivity {
	static #icons = {
		[Activity._states._ok]: "img/activity-icon/activity-icon--state-ok.svg",
		[Activity._states._off]: "img/activity-icon/activity-icon--state-off.svg",
		[Activity._states._idle]: "img/activity-icon/activity-icon--state-idle.svg",
		[Activity._states._error]: "img/activity-icon/activity-icon--state-error.svg"
	};

	constructor(element, idleTimeout = 0, attribute = "src", values = IconActivity.#icons) {
		super(element, idleTimeout, attribute, values);
	}
}

*/


export { CachedPageIconActivity, PageIconActivity, CSSActivity };
