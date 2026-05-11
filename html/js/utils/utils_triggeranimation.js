/**
 * Triggers a CSS animation class on an element and returns a Promise 
 * that resolves when the animation completes.
 * @param {HTMLElement} element - The DOM node to animate.
 * @param {string} className - The CSS class containing the animation.
 * @returns {Promise<void>}
 */
export function triggerAnimation(element, className) {
	return new Promise((resolve) => {
		element.classList.remove(className);

		// force immediate CSS update to reset animation
		void element.offsetWidth;

		element.addEventListener('animationend', () => {
			element.classList.remove(className);
			resolve();
		}, { once: true });

		element.classList.add(className);
	});
}
