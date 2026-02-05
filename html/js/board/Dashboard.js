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
import SoftwareStatsModule from "#modules/SoftwareStatsModule.js";
import ScanModule from "#modules/ScanModule.js";
import UpdatesModule from "#modules/UpdatesModule.js";
import VisitsModule from "#modules/VisitsModule.js";

import { DataTableModule, DummyTableModule } from "#DashboardModule";


const defaultModules = {
	"Approach": ApproachModule,
	"CodexEntry": CodexEntryModule,
	"EventLog": EventLogModule,
	"EventStats": EventStatsModule,
	"FSDJump": FSDJumpModule,
	"GameStats": GameStatsModule,
	"Legend": DummyTableModule,
	"Location": LocationModule,
	"NavRoute": NavRouteModule,
	"NewBodies": NewBodiesModule,
	"NewStars": NewStarsModule,
	"Scan": ScanModule,
	"SoftwareStats": SoftwareStatsModule,
	"Updates": UpdatesModule,
	"Visits": VisitsModule,
};


export class Dashboard {
	#router; // MessageRouter instance
	#container; // new modules appended here
	#infoBox; // data map

	#templates = new Map();
	#readyPromise = null;

	get ready() { return this.#readyPromise ??= this.#loadTemplates(); }
	get container() { return this.#container; }


	constructor(router, options = {}) {
		this.#router = router;

		// TODO: add per-instance modules/templates/template file name to options?
		const { container, infoBox } = options;

		if (container) {
			this.#container = container;
		} else {
			// TODO: template?
			const newContainer = document.createElement("div");
			newContainer.className = "dashboard";
			this.#container = newContainer;
		}

		if (infoBox) {
			this.#infoBox = infoBox;
		}

		void this.ready;
	}


	fromContainer() {
		this.#createInfoBox();

		const divs = this.#container.querySelectorAll("div[data-dashboard__module]");
		for (const div of divs) {
			const moduleName = div.dataset["dashboard__module"];
/*
			const moduleOptions = div.dataset["dashboard__options"];
			// JSON parse options
*/
			const moduleOptions = {};

			const moduleClass = defaultModules[moduleName];
			if (!moduleClass) {
				throw new Error(`Dashboard: no class for module ${moduleName}`);
			}

			div.classList.add("dashboard__table");
			div.replaceChildren(this.#createModule(moduleName, moduleClass, moduleOptions));
		}
	}


	fromArray(modules) {
		this.#createInfoBox();

		const newModules = document.createDocumentFragment();

		for (const module of modules) {
			let moduleName, moduleOptions;

			if (typeof module === "string") {
				moduleName = module;
				moduleOptions = {};
			} else {
				({ name: moduleName, options: moduleOptions = {} } = module);
			}

			const moduleClass = defaultModules[moduleName];
			if (!moduleClass) {
				throw new Error(`Dashboard: no class for module ${moduleName}`);
			}

			const moduleContainer = document.createElement("div");
			moduleContainer.className = "dashboard__table";
			moduleContainer.append(this.#createModule(moduleName, moduleClass, moduleOptions));

			newModules.append(moduleContainer);
		}

		this.#container.append(newModules);
	}


	async #loadTemplates() {
		try {
			const url =`templates.${encodeURIComponent(Config.templateLocale)}.html`;

			console.debug(`Dashboard: loading templates from "${url}"...`);

			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status} ${response.statusText}`);
			}

			const doc = new DOMParser().parseFromString(await response.text(), "text/html");
			const templates = doc.querySelectorAll("template[data-dashboard__module]");

			for (const template of templates) {
				this.#templates.set(template.dataset["dashboard__module"], template);
			}

			console.debug(`Dashboard: loaded ${templates.length} templates`);
		}
		catch (err) {
			throw new Error("Dashboard: template load failed", { cause: err });
		}
	}


	#createModule(name, Module, options) {
		const template = this.#templates.get(name);

		if (!template) {
			console.warn(`Dashboard: no template for module "${name}"`);
		}

		const module = new Module(this.#router, { template, ...options });
		const moduleContainer = module._setupContainer();

		return moduleContainer;
	}


	#createInfoBox() {
		if (!this.#infoBox) {
			const infoBox_template = this.#templates.get("InfoBox");
			if (!infoBox_template) {
				throw new Error("Dashboard: no template for InfoBox");
			}

			const infoBox = new InfoBox(this.#container, infoBox_template);
			this.#infoBox = infoBox;

			this.#container.addEventListener("click", (ev) => {
				const target = ev.target.closest(".data");
				const data = target?.[DataTableModule.DATA_KEY];

				if (data) {
					infoBox.show(data);
				}
			});
		}
	}
}
