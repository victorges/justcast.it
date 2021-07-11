export type NumberFields<T extends string> = { [P in T]: number }

export type Point<T extends string = string> = NumberFields<T> & {
  copy(): Point<T>
  // returns this for chaining
  add(other: Point<T>): Point<T>
  mult(factor: number): Point<T>
}

export function makeAPoint<T extends string>(a: NumberFields<T>): Point<T> {
  const p = a as any as Point<T>
  p.copy = thisCopy.bind(p) as any
  p.add = thisAdd.bind(p) as any
  p.mult = thisMult.bind(p) as any
  return p
}

function thisCopy<T extends string>(this: NumberFields<T>): Point<T> {
  return makeAPoint<T>({ ...this })
}

function thisAdd<T extends Point>(this: T, other: T): T {
  const keys = Object.keys(this) as (keyof typeof this)[]
  for (const key of keys) {
    const mine = this[key]
    if (typeof mine === 'number') {
      const theirs = (other[key] ?? 0) as number
      this[key] = (mine + theirs) as any
    }
  }
  return this
}

function thisMult<T extends Point>(this: T, factor: number): T {
  const keys = Object.keys(this) as (keyof T)[]
  for (const key of keys) {
    const mine = this[key]
    if (typeof mine === 'number') {
      this[key] = (mine * factor) as any
    }
  }
  return this
}

export const sum = <T extends Point>(a: T, b: T) => a.copy().add(b)
export const scale = <T extends Point>(a: T, factor: number) =>
  a.copy().mult(factor)
