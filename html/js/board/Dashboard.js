/**
 * @module board/Dashboard
 * @description Manages the lifecycle of dashboard modules. Loads HTML templates,
 * creates module instances from either DOM elements or a configuration array, and
 * wires them into a {@link MessageRouter} for receiving EDDN events.
 */

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


/**
 * Manages the lifecycle of dashboard modules. Loads HTML templates, creates
 * module instances from either DOM elements or a configuration array, and
 * wires them into a {@link MessageRouter} for receiving EDDN events.
 */
export class Dashboard {
	#router; // MessageRouter instance
	#container; // new modules appended here
	#infoBox; // data map

	#templates = new Map();
	#readyPromise = null;

	/**
	 * Promise that resolves when all HTML templates have been loaded.
	 *
	 * @type {Promise<void>}
	 */
	get ready() { return this.#readyPromise ??= this.#loadTemplates(); }

	/**
	 * The DOM container element that holds all dashboard modules.
	 *
	 * @type {HTMLElement}
	 */
	get container() { return this.#container; }


	/**
	 * Creates a new Dashboard.
	 *
	 * @param {@link MessageRouter} router - The message router that dispatches EDDN events to modules.
	 * @param {Object} [options={}] - Configuration options.
	 * @param {HTMLElement} [options.container] - An existing DOM container; a new `<div>` is created if omitted.
	 * @param {@link InfoBox} [options.infoBox] - An existing InfoBox instance to reuse.
	 */
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


	/**
	 * Creates dashboard modules from `<div data-dashboard__module="...">` elements
	 * found inside the container. Each matching element is replaced with the
	 * rendered module output.
	 */
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


	/**
	 * Creates dashboard modules from an array of module descriptors and appends
	 * them to the container.
	 *
	 * @param {Array<string|{name: string, options?: Object}>} modules - Module descriptors. Each entry is either a module name string or an object with `name` and optional `options`.
	 */
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


	/**
	 * Fetches and parses the HTML template file for the configured locale.
	 * Populates the internal template map keyed by `data-dashboard__module`.
	 *
	 * @returns {Promise<void>}
	 */
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


	/**
	 * Instantiates a single dashboard module and returns its DOM subtree.
	 *
	 * @param {string} name - The module name (used for template lookup).
	 * @param {typeof DashboardModule} Module - The module class constructor.
	 * @param {Object} options - Options forwarded to the module constructor.
	 * @returns {DocumentFragment|null} The rendered module DOM, or `null` if no template exists.
	 */
	#createModule(name, Module, options) {
		const template = this.#templates.get(name);

		if (!template) {
			console.warn(`Dashboard: no template for module "${name}"`);
		}

		const module = new Module(this.#router, { template, ...options });
		const moduleContainer = module._setupContainer();

		return moduleContainer;
	}


	/**
	 * Creates the shared {@link InfoBox} instance (if not already provided)
	 * and attaches a click handler to the container that shows the info box
	 * for any clicked data row.
	 */
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
