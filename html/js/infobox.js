
// displays message contents

// key: typically a <tr> element
// val: an EDDN message object

// assumes that the template is wrapped by a single element


class InfoBox {
	#container; // new InfoBox appended here
	#template; // InfoBox <template> element
	#infoMap = new WeakMap(); // only keep data while the key object exists

	constructor(container, template) {
		this.#container = container;
		this.#template = template;
	}

	set(key, val) { return this.#infoMap.set(key, val); }
	get(key) { return this.#infoMap.get(key); }
	has(key) { return this.#infoMap.has(key); }

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

	static #copyToClipboard(text, element) {
		return new Promise((resolve, reject) => {
			navigator.clipboard.writeText(text)
				.then(() => {
					return InfoBox.#triggerAnimation(element, "infobox__button--signal-success");
				})
				.catch((err) => {
					console.log("copy error:", err);
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

export { InfoBox };
