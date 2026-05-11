/**
 * Safely invokes a callback, returning `undefined` on error.
 *
 * @param {Function} cb - The callback to execute.
 * @param {string} [errMsg] - Message to log on error.
 * @param {...*} [args] - Callback arguments
 * @returns {*|undefined} The result of the callback, or `undefined` if it threw.
 */
export function invoke(cb, errMsg, ...args) {
	try {
		return cb(...args);
	} catch (err) {
		if (errMsg) {
			console.error(errMsg, err);
		}
		return undefined;
	}
}
