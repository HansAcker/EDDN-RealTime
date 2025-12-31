import DashboardModule from "DashboardModule";


export class GalaxyMapModule extends DashboardModule {
	constructor(eddnClient, container, infobox) {
		super(eddnClient, ["journal:FSDJump", "journal:Location", "navroute", "navbeaconscan"], container, infobox);
		this.systems = new Map(); // Store visited systems
	}

	_handleEvent(event) {
		const { StarSystem, StarPos } = event.message;
		
		if (event.type === "navroute") {
			const route = event.message.Route ?? [];
			if (route.length > 1) {
				console.log(`[Map] Plotting Route from ${route[0].StarSystem} to ${route[route.length-1].StarSystem}`);
			}
		}

		if (StarPos && StarPos.length === 3) {
			//console.log(`[Map] Plotting ${StarSystem} at [${StarPos.join(", ")}]`);
			// Logic to draw on canvas/WebGL would go here
			//this.systems.set(StarSystem, StarPos);
		}
	}
}

export default GalaxyMapModule;
