/**
 * Extracts a human-readable label from a Codex key string using the given
 * regex, replacing underscores with spaces.
 *
 * @param {string} str - The raw Codex key string.
 * @param {RegExp} regex - Pattern whose first capture group contains the label.
 * @returns {string} The formatted label, or the original string if no match.
 */
export const formatCodexKey = (str, regex) => regex.exec(str)?.[1]?.replaceAll("_", " ") ?? str;
