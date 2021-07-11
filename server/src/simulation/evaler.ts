import Var, { State, Vector } from './var'

abstract class Evaler {
  abstract copy(): this
  // These should make changes in-place
  abstract derive(time: number): this
  abstract add(other: this): this
  abstract mult(factor: number): this
}

abstract class BaseEvaler<
  N extends number,
  T extends State = number
> extends Evaler {
  constructor(readonly value: Var<Vector<N, T>>) {
    super()
  }

  add(other: this): this {
    this.value.add(other.value)
    return this
  }

  mult(factor: number): this {
    this.value.mult(factor)
    return this
  }
}

class ConstantAcceleration extends BaseEvaler<2> {
  constructor(readonly acceleration: number, state?: Vector<2, number>) {
    super(new Var(state ?? [0, 0]))
  }

  copy(): this {
    const varCopy = this.value.copy()
    return new ConstantAcceleration(this.acceleration, varCopy.state) as this
  }

  derive(time: number): this {
    const {
      state: [position, velocity],
    } = this.value
    this.value.set([velocity, this.acceleration])
    return this
  }
}
