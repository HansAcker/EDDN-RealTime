
// displays message contents

class InfoBox {
	#container;
	#template;
	#infoMap = new WeakMap(); // only keep data while the key object exists

	constructor(container, template) {
		this.#container = container;
		this.#template = template;
	}

	get = this.#infoMap.get.bind(this.#infoMap);
	set = this.#infoMap.set.bind(this.#infoMap);
	has = this.#infoMap.has.bind(this.#infoMap);

	show(key) {
		if (!this.has(key)) {
			return;
		}

		const msg = this.get(key);
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
