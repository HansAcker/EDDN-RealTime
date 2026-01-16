import { Config } from "#config.js";
import { InfoBox } from "#ui/infobox.js";


import FSDJumpModule from "#modules/FSDJumpModule.js";
import NavRouteModule from "#modules/NavRouteModule.js";
import ScanModule from "#modules/ScanModule.js";
import LocationModule from "#modules/LocationModule.js";
import CodexEntryModule from "#modules/CodexEntryModule.js";
import UpdatesModule from "#modules/UpdatesModule.js";
import ApproachModule from "#modules/ApproachModule.js";
import EventStatsModule from "#modules/EventStatsModule.js";
import EventLogModule from "#modules/EventLogModule.js";
import VisitsModule from "#modules/VisitsModule.js";
import NewStarsModule from "#modules/NewStarsModule.js";
import NewBodiesModule from "#modules/NewBodiesModule.js";


export class Dashboard {
	#container;
	#router;
	#infobox;

	#templates = new Map();
	#readyPromise = null;

	get ready() { return this.#readyPromise; }


	constructor(container, router, options) {
		this.#container = container;
		this.#router = router;

		console.debug("Dashboard: loading module templates...");
		this.#readyPromise = this.#loadTemplates();


		// use templates from index.html for now
		const templates = container;
		const infobox_template = templates.querySelector("#infotemplate");

		// import modules...


		// Data window
		const infobox = new InfoBox(container, infobox_template);
		this.#infobox = infobox;

		container.addEventListener("click", (ev) => {
			const target = ev.target.closest(".data");

			if (target && infobox.has(target)) {
				infobox.show(target);
			}
		});



		// statically create and connect modules here for now
		const commonOptions = { infobox, listLength: 20 };

		const _modules = // eslint-disable-line no-unused-vars
		[
			new FSDJumpModule(router, container.querySelector("#FSDJump"), { ...commonOptions, template: templates.querySelector("#FSDJumpTemplate") }),
			new NavRouteModule(router, container.querySelector("#NavRoute"), { ...commonOptions, template: templates.querySelector("#NavRouteTemplate") }),
			new ScanModule(router, container.querySelector("#Scan"), { ...commonOptions, template: templates.querySelector("#ScanTemplate") }),
			new LocationModule(router, container.querySelector("#Docks"), { ...commonOptions, template: templates.querySelector("#LocationTemplate") }),
			new CodexEntryModule(router, container.querySelector("#CodexEntry"), { ...commonOptions, template: templates.querySelector("#CodexEntryTemplate") }),
			new UpdatesModule(router, container.querySelector("#Updates"), { ...commonOptions, template: templates.querySelector("#UpdatesTemplate") }),
			new ApproachModule(router, container.querySelector("#Approach"), { ...commonOptions, template: templates.querySelector("#ApproachTemplate") }),
			new VisitsModule(router, container.querySelector("#Visits"), { ...commonOptions, template: templates.querySelector("#VisitsTemplate") }),
			new NewStarsModule(router, container.querySelector("#NewStars"), { ...commonOptions, template: templates.querySelector("#NewStarsTemplate") }),
			new NewBodiesModule(router, container.querySelector("#NewBodies"), { ...commonOptions, template: templates.querySelector("#NewBodiesTemplate") }),

			new EventLogModule(router, container.querySelector("#EventLog"), { ...commonOptions, template: templates.querySelector("#EventLogTemplate"), listLength: 30 }),

			// no infobox
			new EventStatsModule(router, container.querySelector("#EventStats"), { template: templates.querySelector("#EventStatsTemplate") }),
		];
	}


	async #loadTemplates() {
		const response = await fetch(`templates.${encodeURIComponent(Config.templateLocale)}.html`);

		if (!response.ok) {
			throw new Error("Dashboard: template fetch failed");
		}

		const doc = new DOMParser().parseFromString(await response.text(), "text/html");

		for (const template of doc.querySelectorAll("template[data-dashboard__module]")) {
			this.#templates.set(template.dataset["dashboard__module"], template);
		}

		console.debug("Dashboard: templates loaded");
	}
}
