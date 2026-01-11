/**
 * Manages the display of message contents in a popup/overlay box.
 * Maps UI elements (rows) to their underlying data objects.
 */
export class InfoBox {
	#container; // new InfoBox appended here
	#template; // InfoBox <template> element
	#infoMap = new WeakMap(); // only keep data while the key object exists

	/**
	 * Creates an instance of InfoBox.
	 * @param {HTMLElement} container - The DOM element where the InfoBox will be appended.
	 * @param {HTMLTemplateElement} template - The template element containing the InfoBox structure.
	 */
	constructor(container, template) {
		this.#container = container;
		this.#template = template;
	}

	/**
	 * Associates a UI element (key) with a data object (value).
	 * @param {HTMLElement} key - The UI element (e.g., a row div) to use as the key.
	 * @param {Object} val - The EDDN message object associated with the element.
	 * @returns {WeakMap<HTMLElement, Object>} The updated WeakMap.
	 */
	set(key, val) { return this.#infoMap.set(key, val); }

	/**
	 * Retrieves the data object associated with a UI element.
	 * @param {HTMLElement} key - The UI element to look up.
	 * @returns {Object|undefined} The associated EDDN message object, or undefined if not found.
	 */
	get(key) { return this.#infoMap.get(key); }

	/**
	 * Checks if a UI element has associated data.
	 * @param {HTMLElement} key - The UI element to check.
	 * @returns {boolean} True if the element exists in the map, false otherwise.
	 */
	has(key) { return this.#infoMap.has(key); }

	/**
	 * Displays the InfoBox for a specific UI element.
	 * Retrieves the data associated with the key, populates the template, and appends it to the container.
	 * @param {HTMLElement} key - The UI element (row) that was clicked.
	 * @returns {void}
	 */
	show(key) {
		const msg = this.get(key);

		if (!msg) {
			return;
		}

		const msgText = JSON.stringify(msg, null, 2);

		// clone the template's first child element, a node reference needed to call .remove() on
		// importNode() vs cloneNode() makes a difference if the <template> contains custom elements
		const infoBox = document.importNode(this.#template.content, true).firstElementChild;

		const actions = {
			"copy-msg": (button) => InfoBox.#copyToClipboard(msgText, button),
			"copy-gts": (button) => InfoBox.#copyToClipboard(msg.header?.gatewayTimestamp, button),
			"copy-uid": (button) => InfoBox.#copyToClipboard(msg.header?.uploaderID, button),
			"close": () => infoBox.remove(),
		};

		infoBox.querySelector(".infobox__content").textContent = msgText;

		infoBox.querySelector(".infobox__header").addEventListener("click", (ev) => {
			ev.stopPropagation();

			// find the action button that was clicked
			// TODO: verify that infoBox.contains(target)?
			const target = ev.target.closest(".infobox__header [data-infobox__action]");

			// default action: close on click anywhere in header
			const action = target?.dataset.infobox__action ?? "close";

			// TODO: log if action not found?
			actions[action]?.(target);
		});

		this.#container.append(infoBox);
	}


	// TODO: move to utils?

	/**
	 * Copies text to the clipboard and triggers a success/error animation on the button.
	 * @param {string} text - The text to copy.
	 * @param {HTMLElement} element - The button element to animate.
	 * @returns {Promise<void>} A promise that resolves when the operation is complete.
	 */
	static #copyToClipboard(text, element) {
		return new Promise((resolve, reject) => {
			navigator.clipboard.writeText(text)
				.then(() => {
					return InfoBox.#triggerAnimation(element, "infobox__button--signal-success");
				})
				.catch((err) => {
					console.warn("InfoBox: clipboard copy error:", err);
					InfoBox.#triggerAnimation(element, "infobox__button--signal-error");
					reject(err);
				});
		});
	}

	/**
	 * Triggers a CSS animation class on an element and returns a Promise 
	 * that resolves when the animation completes.
	 * @param {HTMLElement} element - The DOM node to animate.
	 * @param {string} className - The CSS class containing the animation.
	 * @returns {Promise<void>}
	 */
	static #triggerAnimation(element, className) {
		return new Promise((resolve) => {
			element.classList.remove(className);

			// force immediate CSS update to reset animation
			void element.offsetWidth;

			element.addEventListener('animationend', () => {
				element.classList.remove(className);
				resolve();
			}, { once: true });

			element.classList.add(className);
		});
	}
}
