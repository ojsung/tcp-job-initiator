"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * A function to find the index of the least, defined number in an array.  If there is an index to be ignored, it will ignore that index.
 * @param numArray The array of numbers to search for the minimum value
 * @param indicesToIgnore Optional. An array of numbers that signify indices to ignore when searching for the minimum.
 * @returns a number indicating the index in the array of the least value.  If a non-empty indicesToIgnore was provided, it will return -1 if all indices failed or were ignored.
 */
function findMinIndex(numArray, indicesToIgnore = []) {
    const arrayAsLocal = numArray;
    const arrayAsLocalLength = arrayAsLocal.length;
    let min = arrayAsLocal[0];
    let minIndex = -1;
    // If the indicesToIgnore is not empty,
    if (indicesToIgnore.length > 0) {
        for (let i = 0, j = arrayAsLocalLength; i < j; ++i) {
            // make sure that the current index is not one of thoes listed in indicesToIgnore
            if (!indicesToIgnore.includes(i)) {
                const newMinIndex = evaulateMinIndex(arrayAsLocal, i, min);
                // Since evaluateMinIndex returns "void" on a failure,
                // make sure not to send back a void minIndex; instead send back -1
                if (typeof newMinIndex === 'number') {
                    minIndex = newMinIndex;
                }
            }
        }
    }
    else {
        // If we're not worried about ignoring any of the values
        for (let i = 0, j = arrayAsLocalLength; i < j; ++i) {
            const newMin = evaulateMinIndex(arrayAsLocal, i, min);
            // do the same as above
            if (typeof newMin === 'number') {
                minIndex = newMin;
            }
        }
    }
    return minIndex;
}
exports.findMinIndex = findMinIndex;
function evaulateMinIndex(arrayOfNumbers, currentIndex, currentMinimum) {
    const currentValue = arrayOfNumbers[currentIndex];
    if (currentValue !== undefined && currentValue < currentMinimum) {
        return currentIndex;
    }
}
//# sourceMappingURL=find-min-index.js.map