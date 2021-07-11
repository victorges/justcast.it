export default class Vector<N extends number> extends Array<number> {
  constructor(size: N, values: number[]) {
    super(...values)
    if (values.length != size) {
      throw new Error(`must have ${size} elements`)
    }
  }

  copy(): Vector<N> {
    return new Vector(this.length, this)
  }

  add(other: Vector<N>): this {
    for (let i = 0; i < this.length; i++) {
      this[i] += other[i]
    }
    return this
  }

  mult(factor: number): this {
    for (let i = 0; i < this.length; i++) {
      this[i] *= factor
    }
    return this
  }

  unimplemented = () => {
    throw new Error('unsupported')
  }

  push = this.unimplemented
  pop = this.unimplemented
  shift = this.unimplemented
  unshift = this.unimplemented
  splice = this.unimplemented
}
