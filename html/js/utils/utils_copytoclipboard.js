import { triggerAnimation } from "./utils.js";

/**
 * Copies text to the clipboard and triggers a success/error animation on the button.
 * @param {string} text - The text to copy.
 * @param {HTMLElement} element - The button element to animate.
 * @param {string} classNameSuccess - The CSS class to apply to element on success.
 * @param {string} classNameError - The CSS class to apply to element in case of error.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export function copyToClipboard(text, element, classNameSuccess, classNameError) {
	// TODO: make animation class names optional, they are not strictly required

	// clipboard not available in insecure (HTTP) context and others
	if (!navigator.clipboard) {
		console.warn("Clipboard API unavailable");
		return triggerAnimation(element, classNameError);
	}

	return navigator.clipboard.writeText(text)
		.then(() => triggerAnimation(element, classNameSuccess))
		.catch((err) => {
			console.warn("Clipboard copy error:", err);
			return triggerAnimation(element, classNameError);
		});
}
