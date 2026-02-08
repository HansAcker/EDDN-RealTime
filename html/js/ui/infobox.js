/**
 * @module infobox
 * @description Manages the display of EDDN message contents in a popup overlay
 * box with clipboard copy actions. Maps UI elements to their underlying data
 * objects and handles user interactions.
 */

/**
 * Manages the display of message contents in a popup/overlay box.
 * Maps UI elements (rows) to their underlying data objects.
 */
export class InfoBox {
	#container; // new InfoBox appended here
	#template; // InfoBox <template> element

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
	 * Displays the contents of an EDDN message in a popup overlay. Provides
	 * action buttons for copying data to the clipboard and closing the box.
	 *
	 * @param {Object} msg - The EDDN message data object `{ $schemaRef, header, message }`.
	 */
	show(msg) {
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
		// clipboard not available in insecure (HTTP) context and others
		if (!navigator.clipboard) {
			console.warn("InfoBox: clipboard API unavailable");
			return InfoBox.#triggerAnimation(element, "infobox__button--signal-error");
		}

		return navigator.clipboard.writeText(text)
			.then(() => {
				return InfoBox.#triggerAnimation(element, "infobox__button--signal-success");
			})
			.catch((err) => {
				console.warn("InfoBox: clipboard copy error:", err);
				return InfoBox.#triggerAnimation(element, "infobox__button--signal-error");
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
