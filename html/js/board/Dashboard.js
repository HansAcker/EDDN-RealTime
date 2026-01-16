import { Config } from "#config.js";
import { InfoBox } from "#ui/infobox.js";


import ApproachModule from "#modules/ApproachModule.js";
import CodexEntryModule from "#modules/CodexEntryModule.js";
import EventLogModule from "#modules/EventLogModule.js";
import EventStatsModule from "#modules/EventStatsModule.js";
import FSDJumpModule from "#modules/FSDJumpModule.js";
import GameStatsModule from "#modules/GameStatsModule.js";
import LocationModule from "#modules/LocationModule.js";
import NavRouteModule from "#modules/NavRouteModule.js";
import NewBodiesModule from "#modules/NewBodiesModule.js";
import NewStarsModule from "#modules/NewStarsModule.js";
import ScanModule from "#modules/ScanModule.js";
import UpdatesModule from "#modules/UpdatesModule.js";
import VisitsModule from "#modules/VisitsModule.js";


export class Dashboard {
	#container;
	#router;
	#infobox;

	#templates = new Map();
	#readyPromise = null;

	#modules = new Map();


	constructor(container, router, options) {
		this.#container = container;
		this.#router = router;


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
//			new EventStatsModule(router, container.querySelector("#EventStats"), { template: templates.querySelector("#EventStatsTemplate") }),

			new GameStatsModule(router, container.querySelector("#GameStats tbody")),
		];


		void this.ready;
	}


	get ready() {
		if (!this.#readyPromise) {
			this.#readyPromise = this.#loadTemplates();
		}

		return this.#readyPromise;
	}


	async #loadTemplates() {
		try {
			const url =`templates.${encodeURIComponent(Config.templateLocale)}.html`;

			console.debug(`Dashboard: loading templates from "${url}"...`);

			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const doc = new DOMParser().parseFromString(await response.text(), "text/html");
			const templates = doc.querySelectorAll("template[data-dashboard__module]");

			for (const template of templates) {
				this.#templates.set(template.dataset["dashboard__module"], template);
			}

			console.debug(`Dashboard: loaded ${templates.length} templates`);
		}
		catch (err) {
				throw new Error("Dashboard: template load failed:", err);
		}
	}


	#addModule(name, Module, options) {
		const commonOptions = { infobox: this.#infobox, listLength: Config.listLength ?? 20, ...options };

		const template = this.#templates.get(name);
		if (!template) {
			throw new Error(`Dashboard: no template for module name "${name}"`);
		}

		const module = new Module({ ...commonOptions, template });
		const moduleContainer = module._setupContainer();

		this.#container.append(moduleContainer);
		this.#modules.set(name, module);
	}
}
