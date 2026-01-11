import Ajv from "ajv";
import addFormats from "ajv-formats";


export class SchemaValidator {
	constructor() {
		const ajv = new Ajv({ strict: false, allErrors: true });
		addFormats(ajv);
		this.ajv = ajv;
	}

	/**
	 * Compile a schema for repeated use (Performance optimization)
	 * @param {string} name - Unique name/ID for the schema
	 * @param {object} schemaObject - The JSON schema object
	 */
	addSchema(name, schemaObject) {
		this.ajv.addSchema(schemaObject, name);
	}

	/**
	 * Validate data against a registered schema or a raw schema object
	 * @param {string|object} schemaOrId - The schema ID (string) or the Object itself
	 * @param {object} data - The JSON object to validate
	 * @returns {object} - { valid: boolean, errors: array|null }
	 */
	validate(schemaOrId, data) {
		let validateFn;
		if (typeof schemaOrId === "string") {
			validateFn = this.ajv.getSchema(schemaOrId);
			if (!validateFn) throw new Error(`Schema with ID '${schemaOrId}' not found.`);
		} else {
			validateFn = this.ajv.compile(schemaOrId);
		}

		const valid = validateFn(data);

		return {
			valid,
			errors: validateFn.errors
		};
	}
}

// Usage Example
// const validator = new SchemaValidator();
// validator.addSchema("fcmaterials", fcmaterialsSchema);
// const result = validator.validate("fcmaterials", jsonData);
