/**
 * @module Dashboard
 * @description Manages the lifecycle of dashboard modules. Loads HTML templates,
 * creates module instances from either DOM elements or a configuration array, and
 * wires them into a {@link MessageRouter} for receiving EDDN events.
 */


// TODO: Dashboard is missing a destructor/dispose method to
//       - un-observe modules
//       - detach modules from router (impossible with current DashboardModule)
//       - detach InfoBox click handler


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
 *
 * `await dashboard.ready` to load the template file before creating any modules
 */
export class Dashboard {
	static MODULE_KEY = Symbol(); // unique key to attach a module instance to its DOM element

	#router; // MessageRouter instance
	#container; // new modules appended here
	#infoBox; // data map
	#observer; // intersection observer to pause/resume modules

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
	 * @param {MessageRouter} router - The {@link MessageRouter} that dispatches EDDN events to modules.
	 * @param {{ container?: HTMLElement, infoBox?: InfoBox, observer?: IntersectionObserver }} [options={}] - Configuration options.
	 * @param {HTMLElement} [options.container] - An existing DOM container; a new `<div>` is created if omitted.
	 * @param {InfoBox} [options.infoBox] - An existing {@link InfoBox} instance to reuse.
	 * @param {IntersectionObserver} [options.observer] - An existing {@link IntersectionObserver} instance to reuse.
	 */
	constructor(router, options = {}) {
		this.#router = router;

		// TODO: add per-instance modules/templates/template file name to options?
		const { container, infoBox, observer } = options;

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

		// default infobox created after template load

		if (observer) {
			this.#observer = observer;
		} else {
			this.#createObserver();
		}
	}


	/**
	 * Creates dashboard modules from `<div data-dashboard__module="...">` elements
	 * found inside the container. Each matching element is replaced with the
	 * rendered module output.
	 */
	// TODO: guard against double-invocation on the same container
	//       - simpy delete `.dataset["dashboard__module"]`?
	//       - or detach the existing modules from router first
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

			this.#createModule(div, moduleName, moduleOptions);
		}
	}


	/**
	 * Creates dashboard modules from an array of module descriptors and appends
	 * them to the container.
	 *
	 * @param {(string|{ name: string, options?: Record<string, any> })[]} modules - Module descriptors. Each entry is either a module name string or an object with `name` and optional `options`.
	 */
	fromArray(modules) {
		this.#createInfoBox();

		const newModules = document.createDocumentFragment();

		for (const moduleDesc of modules) {
			let moduleName, moduleOptions;

			if (typeof moduleDesc === "string") {
				moduleName = moduleDesc;
				moduleOptions = {};
			} else {
				({ name: moduleName, options: moduleOptions = {} } = moduleDesc);
			}

			const div = document.createElement("div");
			this.#createModule(div, moduleName, moduleOptions);

			newModules.append(div);
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
	 * Instantiates a single dashboard module and adds it to a container element, replacing previous content.
	 *
	 * @param {HTMLElement} container - The outer HTML element.
	 * @param {string} moduleName - The module name (used for template lookup).
	 * @param {Record<string, any>} moduleOptions - Options forwarded to the module constructor.
	 */
	#createModule(container, moduleName, moduleOptions) {
		const template = this.#templates.get(moduleName);

		if (!template) {
			console.warn(`Dashboard: no template for module "${moduleName}"`);
		}

		const ModuleClass = defaultModules[moduleName];
		if (!ModuleClass) {
			throw new Error(`Dashboard: no class for module ${moduleName}`);
		}

		const module = new ModuleClass(this.#router, { template, ...moduleOptions });
		const moduleContainer = module._setupContainer();

		container.classList.add("dashboard__table");
		container.replaceChildren(moduleContainer);
		container[Dashboard.MODULE_KEY] = module;

		this.#observer?.observe(container);
	}


	/**
	 * Creates the shared {@link InfoBox} instance (if not already provided)
	 * and attaches a click handler to the container that shows the info box
	 * for any clicked data row.
	 */
	#createInfoBox() {
		if (this.#infoBox) {
			return;
		}

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


	/**
	 * Create the IntersectionObserver to pause/resume modules when they scroll out of view
	 */
	#createObserver() {
		if (this.#observer) {
			return;
		}

		const observerOptions = {}; // use defaults: root viewport, 0px margins, 0% threshold
		this.#observer = new IntersectionObserver((entries, _observer) => this.#observe(entries), observerOptions);
	}


	/**
	 * Set module running state on visibility changes
	 *
	 * @param {IntersectionObserverEntry[]} entries - A list of objects containing information about the threshold crossings.
	 */
	#observe(entries) {
		for (const entry of entries) {
			const module = entry.target?.[Dashboard.MODULE_KEY];
			if (module && "paused" in module) {
				module.paused = !entry.isIntersecting;
			}
		}
	}
}
