export type NumberFields<T extends string> = { [P in T]: number }

export type NumberRecord<T extends string = string> = NumberFields<T> & {
  copy(): NumberRecord<T>
  // returns this for chaining
  add(other: NumberRecord<T>): NumberRecord<T>
  mult(factor: number): NumberRecord<T>
}

export function makeRecord<T extends string>(
  a: NumberFields<T>
): NumberRecord<T> {
  let rec = a as any as NumberRecord<T>
  rec.copy = thisCopy.bind(rec) as any
  rec.add = thisAdd.bind(rec) as any
  rec.mult = thisMult.bind(rec) as any
  return rec
}

function thisCopy<T extends string>(this: NumberFields<T>): NumberRecord<T> {
  return makeRecord<T>({ ...this })
}

function thisAdd<T extends NumberRecord>(this: T, other: T): T {
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

function thisMult<T extends NumberRecord>(this: T, factor: number): T {
  const keys = Object.keys(this) as (keyof T)[]
  for (const key of keys) {
    const mine = this[key]
    if (typeof mine === 'number') {
      this[key] = (mine * factor) as any
    }
  }
  return this
}

export const sum = <T extends NumberRecord>(a: T, b: T) => a.copy().add(b)
export const scale = <T extends NumberRecord>(a: T, factor: number) =>
  a.copy().mult(factor)
