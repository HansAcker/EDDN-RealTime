
// displays message contents

// key: typically a <tr> element
// val: an EDDN message object

// TODO: use DocumentFragments and importNode()?


class InfoBox {
	#container; // new InfoBox appended here
	#template; // InfoBox DOM template root node
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
		const infoBox = this.#template.cloneNode(true);

		infoBox.querySelector(".infobox__content").textContent = msgText;

		infoBox.querySelector(".infobox__header").addEventListener("click", (ev) => {
			ev.stopPropagation();

			// find the action button that was clicked
			const target = ev.target.closest(".infobox__header [data-infobox__action]");
			const action = target?.dataset.infobox__action;

			// TODO: use async copy, handle error
			const actions = {
				"copy-msg": () => navigator.clipboard.writeText(msgText),
				"copy-gts": () => navigator.clipboard.writeText(msg.header?.gatewayTimestamp),
				"copy-uid": () => navigator.clipboard.writeText(msg.header?.uploaderID),
				"close": () => infoBox.remove(),
			};

			if (action in actions) {
				actions[action]();
			} else {
				// default action: close on click anywhere in header
				infoBox.remove();
			}
		});

		this.#container.append(infoBox);
	}
}

export { InfoBox };
