/**
 * @module infobox
 * @description Manages the display of EDDN message contents in a popup overlay
 * box with clipboard copy actions. Maps UI elements to their underlying data
 * objects and handles user interactions.
 */

import { copyToClipboard } from "#utils.js";


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
	 * @param {object} msg - The EDDN message data object.
	 * @param {string} msg.$schemaRef - The schema reference URL.
	 * @param {Record<string, any>} msg.header - The EDDN header (uploaderID, gatewayTimestamp, etc.).
	 * @param {Record<string, any>} msg.message - The actual game data.
	 */
	show(msg) {
		if (!msg) {
			return;
		}

		const msgText = JSON.stringify(msg, null, 2);

		// clone the template's first child element, a node reference needed to call .remove() on
		// importNode() vs cloneNode() makes a difference if the <template> contains custom elements
		const infoBox = document.importNode(this.#template.content, true).firstElementChild;

		const classSuccess = "infobox__button--signal-success";
		const classError = "infobox__button--signal-error";

		const actions = {
			"copy-msg": (button) => copyToClipboard(msgText, button, classSuccess, classError),
			"copy-gts": (button) => copyToClipboard(msg.header?.gatewayTimestamp, button, classSuccess, classError),
			"copy-uid": (button) => copyToClipboard(msg.header?.uploaderID, button, classSuccess, classError),
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
}
