"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Integers are all numbers with no decimal value
 * For this definition, 1.00 is not considered an integer; it is a decimal value.
 */
class Integer extends Number {
    constructor(num) {
        super();
        this.value = this.valueOf();
        if (!Number.isInteger(this.value))
            throw new Error('Expected a number without a decimal value.');
    }
}
exports.Integer = Integer;
/**
 * Natural numbers are all integers greater than zero.
 */
class Natural extends Integer {
    constructor(num) {
        super(num);
        this.value = this.valueOf();
        if (Math.abs(this.value) !== this.value || this.value === 0)
            throw new Error('Expected an integer greater than zero.');
    }
}
exports.Natural = Natural;
//# sourceMappingURL=tcp-server-info.interface.js.map