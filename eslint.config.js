import js from "@eslint/js";
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
	}
];
