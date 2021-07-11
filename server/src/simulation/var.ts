export default class Var<S extends State = State> {
  constructor(public state: S) {}

  copy(): Var<S> {
    return new Var(stateCopy(this.state))
  }

  // All operators below returns `this` for chaining, but everything is done
  // inline on the current state. Also sets this.state only in case it is a number.

  set(other: VarOrState<S>): Var<S> {
    this.state = stateSet(this.state, extractState(other))
    return this
  }

  add(other: VarOrState<S>): Var<S> {
    this.state = stateAdd(this.state, extractState(other))
    return this
  }

  mult(factor: number): Var<S> {
    this.state = stateMult(this.state, factor)
    return this
  }
}

type VarOrState<S extends State> = Var<S> | S

function extractState<S extends State>(vos: VarOrState<S>): S {
  if (isNumber(vos)) {
    return vos as S
  }
  const nnvos = vos as Exclude<typeof vos, number>
  return ('state' in nnvos ? nnvos.state : vos) as S
}

type Item<T> = T extends Array<infer I> ? I : T
type First<T extends unknown[]> = T extends [infer L, ...any] ? L : Item<T>
type Shift<T extends unknown[]> = T extends [any, ...infer R] ? R : Item<T>[]

export type StateRecord<K extends string[]> = {
  [P in First<K>]: State<Shift<K>>
}

export type State<K extends string[] = string[]> =
  | number
  | State<K>[]
  | StateRecord<K>

const isNumber = (st: any): st is number => typeof st === 'number'
const isArray = (st: State): st is State[] => Array.isArray(st)
const isRecord = (st: State): st is StateRecord<string[]> =>
  typeof st === 'object' && !Array.isArray(st)

function stateCopy<T extends State>(st: T): T {
  if (isNumber(st)) {
    return st
  } else if (isArray(st)) {
    return st.map((v) => stateCopy(v)) as T
  } else if (isRecord(st)) {
    return Object.fromEntries(
      Object.entries(st).map(([k, v]) => [k, stateCopy(v)])
    ) as T
  } else {
    throw new Error('unknown state type')
  }
}

function stateSet<T extends State>(dest: T, other: T): T {
  if (isNumber(dest) && isNumber(other)) {
    return other
  } else if (isArray(dest) && isArray(other)) {
    for (let i = 0; i < dest.length; i++) {
      dest[i] = stateSet(dest[i], other[i])
    }
    return dest
  } else if (isRecord(dest) && isRecord(other)) {
    const keys = Object.keys(dest) as (keyof T)[]
    for (const key of keys) {
      dest[key] = stateSet(dest[key], other[key])
    }
    return dest
  } else {
    throw new Error('unknown or mismatching state types')
  }
}

function stateAdd<T extends State>(dest: T, other: T): T {
  if (isNumber(dest) && isNumber(other)) {
    return (dest + other) as T
  } else if (isArray(dest) && isArray(other)) {
    for (let i = 0; i < dest.length; i++) {
      dest[i] = stateAdd(dest[i], other[i])
    }
    return dest
  } else if (isRecord(dest) && isRecord(other)) {
    const keys = Object.keys(dest) as (keyof T)[]
    for (const key of keys) {
      dest[key] = stateAdd(dest[key], other[key])
    }
    return dest
  } else {
    throw new Error('unknown or mismatching state types')
  }
}

function stateMult<T extends State>(dest: T, factor: number): T {
  if (isNumber(dest)) {
    return (dest * factor) as T
  } else if (isArray(dest)) {
    for (let i = 0; i < dest.length; i++) {
      dest[i] = stateMult(dest[i], factor)
    }
    return dest
  } else if (isRecord(dest)) {
    const keys = Object.keys(dest) as (keyof T)[]
    for (const key of keys) {
      dest[key] = stateMult(dest[key], factor)
    }
    return dest
  } else {
    throw new Error('unknown state type')
  }
}
