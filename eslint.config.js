import js from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";


export default [
	js.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 2025,
			sourceType: "module",
			globals: {
				...globals.browser
			}
		},
		rules: {
			"no-unused-vars": [
				"warn",
				{
					"argsIgnorePattern": "^_",
//					"varsIgnorePattern": "^_",
//					"caughtErrorsIgnorePattern": "^_"
				}
			],
			"prefer-const": "error",
			"semi": ["error", "always"]
		}
	},
	{
		plugins: { jsdoc },
		rules: {
			// Require JSDoc comments for public functions, methods, and classes (exclude privates)
			"jsdoc/require-jsdoc": ["warn", {
				contexts: [
					"FunctionDeclaration",  // Require on function declarations
					"MethodDefinition:not([key.type=\"PrivateIdentifier\"])",  // Require on public methods only
					"ClassDeclaration"  // Require on classes
					// Note: Excluding PropertyDefinition (no require on properties)
					// Note: Excluding ArrowFunctionExpression/FunctionExpression (no require on expressions)
				]
			}],
			// Require descriptions in JSDoc
			//"jsdoc/require-description": "warn",
			// Validate @param tags match function parameters
			"jsdoc/check-param-names": "warn",
			// Require @param types
			"jsdoc/require-param-type": "warn",
			// Require @returns for non-void functions
			"jsdoc/require-returns-type": "warn",
			// Check for valid JSDoc syntax
			"jsdoc/check-syntax": "error",
			// Enforce consistent formatting (e.g., alignment)
			"jsdoc/check-alignment": "warn"
		},
		settings: {
			jsdoc: {
				mode: "closure"  // Matches standard JSDoc (not TypeScript-style)
			}
		}
	}
];
