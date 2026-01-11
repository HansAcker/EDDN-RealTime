import js from "@eslint/js";
import globals from "globals";


export default [
	{
		ignores: ["**/dist/*", "**/old/*"],
	},
	js.configs.recommended,
	{
		files: ["html/js/**/*.js"],
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
			"prefer-const": "error"
			// "semi": ["error", "always"]
		}
	}
];
