import { stripPrefix } from "./utils.js";


/**
 * Removes a prefix from a string and trims whitespace.
 *
 * @param {string} str - The string to process.
 * @param {string} prefix - The prefix to remove.
 * @returns {string}
 */
export const trimPrefix = (str, prefix) => stripPrefix(str, prefix).trim();
