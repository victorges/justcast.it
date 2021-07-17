import './types'

export default class Var<S extends State = State> {
  constructor(public state: S) {}

  copy(): Var<S> {
    return new Var(stateCopy(this.state))
  }

  // All operators below returns `this` for chaining, but everything is done
  // inline on the current state. Also sets this.state only in case it is a number.

  add = Var.makeBinOp(this, (a, b) => a + b)
  sub = Var.makeBinOp(this, (a, b) => a - b)
  mult = Var.makeBinOp(this, (a, b) => a * b)
  div = Var.makeBinOp(this, (a, b) => a / b)

  get<KP extends ObjKey[]>(keyPath: KP): PropPath<S, KP> {
    return stateProp(this.state, keyPath)
  }
  set = Var.makeBinOp(this, (_, b) => b)

  scale(factor: number): Var<S> {
    this.state = stateScale(this.state, factor)
    return this
  }

  zero(): Var<S> {
    return this.scale(0)
  }

  static makeBinOp<S extends State>(inst: Var<S>, op: BinaryOp) {
    function opFunc(other: S | Var<S>): Var<S>
    function opFunc<KP extends ObjKeyPath>(
      keyPath: KP,
      other: PropPath<S, KP>
    ): Var<S>
    function opFunc<KP extends ObjKeyPath>(
      this: Var<S>,
      pathOrOther: KP | S | Var<S>,
      otherProp?: PropPath<S, KP>
    ): Var<S> {
      return this.propBinOp(pathOrOther, otherProp, op)
    }
    return opFunc.bind(inst)
  }

  private propBinOp<KP extends ObjKeyPath>(
    pathOrOther: KP | S | Var<S>,
    otherProp: PropPath<S, KP> | undefined,
    op: BinaryOp
  ): this {
    let path: KP
    let other: PropPath<S, KP>
    if (otherProp !== undefined) {
      path = pathOrOther as KP
      other = otherProp
    } else {
      path = [] as any
      other = (
        pathOrOther instanceof Var ? pathOrOther.state : pathOrOther
      ) as PropPath<S, KP>
    }
    this.state = statePropBinOp(this.state, path, other, op)
    return this
  }
}

export type StateRecord<K extends string[] = string[]> = K extends never[]
  ? never
  : {
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

export function stateProp<T extends State, KP extends ObjKey[]>(
  st: T,
  keyPath: KP
): PropPath<T, KP> {
  let val: any = st
  for (const key of keyPath) {
    if (!(key in val)) {
      return undefined as never
    }
    val = val[key]
  }
  return val
}

export function statePropBinOp<T extends State, KP extends ObjKeyPath>(
  st: T,
  keyPath: KP,
  newVal: PropPath<T, KP>,
  op: BinaryOp
): T {
  if (keyPath.length === 0) {
    return stateBinOp(st, newVal as PropPath<T, []>, op)
  }
  let val: any = st
  const last = keyPath.length - 1
  for (let i = 0; i <= last; i++) {
    const key = keyPath[i]
    if (typeof val === 'number' || !(key in val)) {
      throw new Error(`key ${key.toString()} not found in ${val}`)
    }
    if (i < last) {
      val = val[key]
    } else {
      val = val[key] = stateBinOp(val[key], newVal, op)
    }
  }
  return st
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

export type Vector<
  N extends number = number,
  T extends State = number
> = N extends 0
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
