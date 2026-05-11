/** Return the distance between two vectors of equal dimensions
 * @param {number[]} v0 First vector of arbitrary dimensions
 * @param {number[]} v1 Second vector of equal dimensions as v0
 * @returns {number}
 */
export const distanceN = (v0, v1) => Math.hypot(...v0.map((v, i) => v - v1[i]));


/** Return the distance between two 3D vectors
 * @param {[number, number, number]} v0 First 3D vector
 * @param {[number, number, number]} v1 Second 3D vector
 * @returns {number}
 */
export const distance3 = (v0, v1) => Math.hypot(v0[0] - v1[0], v0[1] - v1[1], v0[2] - v1[2]); // subtract vectors, return length
