import { EDDNEvent } from "EDDNEvent";
import { SchemaValidator } from "./SchemaValidator.js";

const validator = new SchemaValidator();

const eddn_schema_files = {
	"approachsettlement": "/schemas/approachsettlement-v1.0.json",
	"blackmarket": "/schemas/blackmarket-v1.0.json",
	"codexentry": "/schemas/codexentry-v1.0.json",
	"commodity": "/schemas/commodity-v3.0.json",
	"dockingdenied": "/schemas/dockingdenied-v1.0.json",
	"dockinggranted": "/schemas/dockinggranted-v1.0.json",
	"fcmaterials_capi": "/schemas/fcmaterials_capi-v1.0.json",
	"fcmaterials_journal": "/schemas/fcmaterials_journal-v1.0.json",
	"fssallbodiesfound": "/schemas/fssallbodiesfound-v1.0.json",
	"fssbodysignals": "/schemas/fssbodysignals-v1.0.json",
	"fssdiscoveryscan": "/schemas/fssdiscoveryscan-v1.0.json",
	"fsssignaldiscovered": "/schemas/fsssignaldiscovered-v1.0.json",
	"journal": "/schemas/journal-v1.0.json",
	"navbeaconscan": "/schemas/navbeaconscan-v1.0.json",
	"navroute": "/schemas/navroute-v1.0.json",
	"outfitting": "/schemas/outfitting-v2.0.json",
	"scanbarycentre": "/schemas/scanbarycentre-v1.0.json",
	"shipyard": "/schemas/shipyard-v2.0.json",
}

const eddn_schemas = {}

// import JSON schema data
const imports = [];
for (const schema_name in eddn_schema_files) {
	imports.push(new Promise((resolve) => {
		import(eddn_schema_files[schema_name], { with: { type: "json" } })
		.then((result) => {
			const schema = result.default;
			eddn_schemas[schema_name] = schema;
			validator.addSchema(schema_name, schema);
			resolve();
		})
		.catch((error) => {
			//console.error("import error:", schema_name, error);
			resolve({schema_name, error});
		})
	}));
}

console.log((await Promise.all(imports)).filter(val => val));

client.addEventListener("eddn:message", (ev) => {
	const schema_name = EDDNEvent.getEventType(ev.data).replace(/:.*/, "");
	if (schema_name in eddn_schemas) {
		const val_result = validator.validate(schema_name, ev.data);
		if (!val_result.valid) {
			console.log("validation errors:", val_result.errors);
		}
	} else {
		console.log("No schema for", schema_name, ev.$schemaRef, ev.data);
	}
});
