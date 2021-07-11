import Var from './var'

export type VectorElm = number | Vector<number, VectorElm> | Var

export default class Vector<
  N extends number,
  T extends VectorElm = number
> extends Array<T> {
  constructor(size: N, values: SizedArray<N, T>) {
    super(...values)
    if (values.length != size) {
      throw new Error(`must have ${size} elements`)
    }
  }

  copy(): Vector<N, T> {
    return new Vector(this.length, this)
  }

  set(values: ArrayOrVector<N, T>): this {
    for (let i = 0; i < this.length; i++) {
      this[i] = values[i]
    }
    return this
  }

  add(other: ArrayOrVector<N, T>): this {
    for (let i = 0; i < this.length; i++) {
      const elm = this[i]
      if (typeof elm === 'number') {
        const otherElm = other[i] as number
        this[i] = (elm + otherElm) as T
      } else {
        const otherElm = other[i] as Var & Vector<number, T>
        elm.add(otherElm)
      }
    }
    return this
  }

  mult(factor: number): this {
    for (let i = 0; i < this.length; i++) {
      const elm = this[i]
      if (typeof elm === 'number') {
        this[i] = (elm * factor) as T
      } else {
        elm.mult(factor)
      }
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

type ArrayOrVector<N extends number, T extends VectorElm> =
  | SizedArray<N, T>
  | Vector<N, T>

type SizedArray<N extends number, T> = N extends 0
  ? []
  : N extends 1
  ? [T]
  : N extends 2
  ? [T, T]
  : N extends 3
  ? [T, T, T]
  : N extends 4
  ? [T, T, T, T]
  : N extends 5
  ? [T, T, T, T, T]
  : T[]
