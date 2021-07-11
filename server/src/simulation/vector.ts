export default class Vector<N extends number> extends Array<number> {
  constructor(size: N, values: NumberArray<N>) {
    super(...values)
    if (values.length != size) {
      throw new Error(`must have ${size} elements`)
    }
  }

  copy(): Vector<N> {
    return new Vector(this.length, this)
  }

  set(values: ArrayOrVector<N>): this {
    for (let i = 0; i < this.length; i++) {
      this[i] = values[i]
    }
    return this
  }

  add(other: ArrayOrVector<N>): this {
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

type ArrayOrVector<N extends number> = NumberArray<N> | Vector<N>

type NumberArray<N extends number> = N extends 0
  ? []
  : N extends 1
  ? [number]
  : N extends 2
  ? [number, number]
  : N extends 3
  ? [number, number, number]
  : N extends 4
  ? [number, number, number, number]
  : N extends 5
  ? [number, number, number, number, number]
  : number[]
