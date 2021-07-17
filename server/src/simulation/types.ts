import 'util' // dummy

declare global {
  type Item<T> = T extends Array<infer I> ? I : T[any]
  type First<T extends readonly any[]> = T extends readonly [infer L, ...any]
    ? L
    : Item<T>
  type Shift<T extends readonly any[]> = T extends readonly [any, ...infer R]
    ? R
    : T

  type ObjKey = keyof any
  type ObjKeyPath = readonly ObjKey[]

  type Prop<T, K extends ObjKey> = T[K & keyof T]

  type PropPath<
    T,
    KP extends ObjKeyPath,
    CallStack = never
  > = KP extends never[]
    ? T
    : T extends CallStack // stop at recursive types
    ? T
    : PropPath<Prop<T, First<KP>>, Shift<KP>, CallStack | T>
}
