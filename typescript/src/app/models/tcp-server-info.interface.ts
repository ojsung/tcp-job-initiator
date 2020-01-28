/**
 * A number with no decimal value
 */
type integer = number

/**
 * An integer greater than zero.
 */
type natural = number

/**
 * Integers are all numbers with no decimal value
 * For this definition, 1.00 is not considered an integer; it is a decimal value.
 */
class Integer extends Number {
  constructor(num: number | Number) {
    super()
    if (!Number.isInteger(this.value)) throw new Error('Expected a number without a decimal value.')
  }
  public value: integer = this.valueOf()
}

/**
 * Natural numbers are all integers greater than zero.
 */
class Natural extends Integer {
  constructor(num: number | Number) {
    super(num)
    if (Math.abs(this.value) !== this.value || this.value === 0) throw new Error('Expected an integer greater than zero.')
  }

  public value: natural = this.valueOf()
}

export { integer, natural, Integer, Natural }
