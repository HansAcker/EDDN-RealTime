class InfoBox {
	#container;
	#template;
	#infoMap = new WeakMap();

	constructor(container, template) {
		this.#container = container;
		this.#template = template;
	}

	set(element, data) {
		this.#infoMap.set(element, data);
	}

	has(element) {
		return this.#infoMap.has(element);
	}

	show(element) {
		if (!this.has(element)) {
			return;
		}

		const msg = this.#infoMap.get(element);
		const msgText = JSON.stringify(msg, null, 2);

		const infoBox = this.#template.cloneNode(true);
		infoBox.querySelector(".infobox__content").textContent = msgText;

		infoBox.querySelector(".infobox__header").addEventListener("click", (ev) => {
			ev.stopPropagation();

			if (ev.target.classList.contains("infobox__button--copy-msg")) {
				navigator.clipboard.writeText(msgText);
			}
			else if (ev.target.classList.contains("infobox__button--copy-gts")) {
				navigator.clipboard.writeText(msg.header.gatewayTimestamp);
			}
			else if (ev.target.classList.contains("infobox__button--copy-uid")) {
				navigator.clipboard.writeText(msg.header.uploaderID);
			}
			else { /* if (ev.target.classList.contains("infobox__button--close")) { */
				infoBox.remove();
			}
		});

		this.#container.append(infoBox);
	}
}

export { InfoBox };
