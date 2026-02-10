/**
 * @module activity_icon
 * @description Activity indicator classes that visually reflect the current
 * connection state (ok / idle / off / error). Subclasses update the page
 * favicon ({@link PageIconActivity}, {@link CachedPageIconActivity}) or CSS
 * classes ({@link CSSActivity}).
 */

// TODO: rename everything


// activity status
// changes from ok to idle after idleTimeout, all other states use no timer

/**
 * Base class for activity indicators. Tracks a state machine with four
 * states (`ok`, `idle`, `off`, `error`) and an optional idle timer that
 * transitions from `ok` to `idle` after a configurable timeout.
 */
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

	/**
	 * Creates a new Activity indicator.
	 *
	 * @param {HTMLElement} element - The DOM element whose appearance reflects the activity state.
	 * @param {number} [idleTimeout=0] - Milliseconds before the state automatically transitions from `ok` to `idle`. `0` disables the timer.
	 */
	constructor(element, idleTimeout = 0) {
		this._element = element;
		this.#idleTimeout = idleTimeout;
	}

	/**
	 * Called when the activity state changes. Override in subclasses to apply
	 * visual updates.
	 *
	 * @param {symbol} _newState - The new activity state symbol.
	 * @param {symbol} _oldState - The previous activity state symbol.
	 */
	_changeState(_newState, _oldState) {
		// base class does nothing here
	}

	/**
	 * Internal state setter. Clears any pending idle timer, invokes
	 * {@link Activity#_changeState} if the state actually changed, and
	 * optionally starts a new idle timer.
	 *
	 * @param {symbol} state - The target state symbol.
	 * @param {number} [timeout=0] - Milliseconds before automatically transitioning to idle.
	 */
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

	/** Transitions to the `ok` state and starts the idle timer. */
	ok = () => this.#set(Activity._states._ok, this.#idleTimeout);
	/** Transitions to the `off` state. */
	off = () => this.#set(Activity._states._off, 0);
	/** Transitions to the `idle` state. */
	idle = () => this.#set(Activity._states._idle, 0);
	/** Transitions to the `error` state. */
	error = () => this.#set(Activity._states._error, 0);
}


/**
 * Activity indicator that updates the `href` attribute of a DOM element
 * (typically a `<link rel="icon">`) to point at a state-specific SVG icon.
 *
 * @extends Activity
 */
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

	/**
	 * Updates the element's `href` to the icon path for the new state.
	 *
	 * @param {symbol} newState - The new activity state symbol.
	 * @param {symbol} _oldState - The previous activity state symbol.
	 */
	_changeState(newState, _oldState) {
		this._element.href = PageIconActivity.#icons[newState];
	}
}


/**
 * A {@link PageIconActivity} subclass that pre-loads all state icons into
 * `blob:` URLs so the browser does not re-fetch them on every state change.
 *
 * @extends PageIconActivity
 */
// pre-loads icons into "blob:" URLs
class CachedPageIconActivity extends PageIconActivity {
	#cache = new Map(); // state -> blob
	#readyPromise = null; // `await CachedPageIconActivity.ready`
	[Symbol.dispose] = () => this.clear(); // support automatic blob release with `using`


	/**
	 * Promise that resolves when all activity icons have been pre-loaded.
	 *
	 * @type {Promise<PromiseSettledResult[]>}
	 */
	get ready() { return this.#readyPromise ??= this.#preloadIcons(); }


	/**
	 * Creates a new CachedPageIconActivity and kicks off icon pre-loading.
	 *
	 * @param {HTMLElement} element - The DOM element whose `href` reflects the activity state.
	 * @param {number} idleTimeout - Milliseconds before automatically transitioning from `ok` to `idle`.
	 */
	// TODO: support an `{ AbortController.signal }` option and call `clear()`?
	constructor(element, idleTimeout) {
		super(element, idleTimeout);

		// start async fetches
		void this.ready;
	}

	/**
	 * Updates the element's `href` from the pre-loaded blob cache, falling
	 * back to the parent class behaviour if the icon has not been cached.
	 *
	 * @param {symbol} newState - The new activity state symbol.
	 * @param {symbol} oldState - The previous activity state symbol.
	 */
	_changeState(newState, oldState) {
		if (this.#cache.has(newState)) {
			this._element.href = this.#cache.get(newState);
		} else {
			console.debug(`CachedPageIconActivity: no cache for ${newState.toString()}`);
			super._changeState(newState, oldState);
		}
	}

	/**
	 * Fetches all activity icon SVGs and stores them as `blob:` URLs.
	 *
	 * @returns {Promise<PromiseSettledResult[]>}
	 */
	async #preloadIcons() {
		// TODO: merge with PageIconActivity.#icons. use "_icons" instead of "#"?
		const ICON_PATHS = {
			[Activity._states._ok]: "img/activity-icon/activity-icon--state-ok.svg",
			[Activity._states._off]: "img/activity-icon/activity-icon--state-off.svg",
			[Activity._states._idle]: "img/activity-icon/activity-icon--state-idle.svg",
			[Activity._states._error]: "img/activity-icon/activity-icon--state-error.svg"
		};

		console.debug("CachedPageIconActivity: loading activity icons...");
		const loadPromises = Object.getOwnPropertySymbols(ICON_PATHS).map(async (state) => {
			const path = ICON_PATHS[state];
			try {
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

	/**
	 * Releases all cached blob URLs and clears the cache Map.
	 */
	clear() {
		for (const [ , url ] of this.#cache) {
			URL.revokeObjectURL(url);
		}
		this.#cache.clear();
		this.#readyPromise = null;
	}
}


/**
 * Activity indicator that toggles CSS classes on the target element to
 * reflect the current state.
 *
 * @extends Activity
 */
// adds/removes CSS classes

class CSSActivity extends Activity {
	static #classes = {
		[Activity._states._ok]: "activity-icon--state-ok",
		[Activity._states._off]: "activity-icon--state-off",
		[Activity._states._idle]: "activity-icon--state-idle",
		[Activity._states._error]: "activity-icon--state-error"
	};

	/**
	 * Adds the CSS class for the new state and removes the class for the old
	 * state from the target element.
	 *
	 * @param {symbol} newState - The new activity state symbol.
	 * @param {symbol} oldState - The previous activity state symbol.
	 */
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
