export default class Var<S extends State = State> {
  constructor(public state: S) {}

  copy(): Var<S> {
    return new Var(stateCopy(this.state))
  }

  // All operators below returns `this` for chaining, but everything is done
  // inline on the current state. Also sets this.state only in case it is a number.

  get<T extends any[], R = PropPath<S, T>>(...keyPath: T): R {
    return stateProp(this.state, ...keyPath)
  }

  set(other: VarOrState<S>): Var<S> {
    return this.binOp(other, (_, b) => b)
  }

  add(other: VarOrState<S>): Var<S> {
    return this.binOp(other, (a, b) => a + b)
  }

  sub(other: VarOrState<S>): Var<S> {
    return this.binOp(other, (a, b) => a - b)
  }

  mult(other: VarOrState<S>): Var<S> {
    return this.binOp(other, (a, b) => a * b)
  }

  div(other: VarOrState<S>): Var<S> {
    return this.binOp(other, (a, b) => a / b)
  }

  scale(factor: number): Var<S> {
    this.state = stateScale(this.state, factor)
    return this
  }

  zero(): Var<S> {
    return this.scale(0)
  }

  private binOp(other: VarOrState<S>, op: BinaryOp): Var<S> {
    this.state = stateBinOp(this.state, extractState(other), op)
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

type Prop<T, K> = K extends keyof T ? T[K] : never

type PropPath<T, KP extends any[]> = KP extends []
  ? T
  : PropPath<Prop<T, First<KP>>, Shift<KP>>

export type StateRecord<K extends string[] = string[]> = {
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

export function stateCopy<T extends State>(st: T): T {
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

export function stateProp<
  T extends State,
  KP extends any[],
  R = PropPath<T, KP>
>(st: T, ...keyPath: KP): R {
  let val: any = st
  for (const key of keyPath) {
    if (!(key in val)) {
      return undefined as never
    }
    val = val[key]
  }
  return val
}

type BinaryOp = (a: number, b: number) => number

export function stateBinOp<T extends State>(
  dest: T,
  other: T,
  op: BinaryOp
): T {
  if (isNumber(dest) && isNumber(other)) {
    return op(dest, other) as T
  } else if (isArray(dest) && isArray(other)) {
    for (let i = 0; i < dest.length; i++) {
      dest[i] = stateBinOp(dest[i], other[i], op)
    }
    return dest
  } else if (isRecord(dest) && isRecord(other)) {
    const keys = Object.keys(dest) as (keyof T)[]
    for (const key of keys) {
      dest[key] = stateBinOp(dest[key], other[key], op)
    }
    return dest
  } else {
    throw new Error('unknown or mismatching state types')
  }
}

export function stateScale<T extends State>(dest: T, factor: number): T {
  if (isNumber(dest)) {
    return (dest * factor) as T
  } else if (isArray(dest)) {
    for (let i = 0; i < dest.length; i++) {
      dest[i] = stateScale(dest[i], factor)
    }
    return dest
  } else if (isRecord(dest)) {
    const keys = Object.keys(dest) as (keyof T)[]
    for (const key of keys) {
      dest[key] = stateScale(dest[key], factor)
    }
    return dest
  } else {
    throw new Error('unknown state type')
  }
}

type ExtendsState<T> = T extends State ? T : never

export type Vector<N extends number, T extends State = State> = ExtendsState<
  N extends 0
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
>
