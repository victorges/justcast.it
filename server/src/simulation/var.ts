import Vector from './vector'

abstract class Var {
  abstract copy(): this
  // These should make changes in-place
  abstract derive(time: number): this
  abstract add(other: this): this
  abstract mult(factor: number): this
}

abstract class BaseVar<N extends number> extends Var {
  constructor(readonly state: Vector<N>) {
    super()
  }

  add(other: this): this {
    this.state.add(other.state)
    return this
  }

  mult(factor: number): this {
    this.state.mult(factor)
    return this
  }
}

class ConstantAcceleration extends BaseVar<2> {
  constructor(readonly acceleration: number, state?: Vector<2>) {
    super(state ?? new Vector(2, [0, 0]))
  }

  copy(): this {
    return new ConstantAcceleration(this.acceleration, this.state) as this
  }

  derive(time: number): this {
    this.state[0] = this.state[1]
    this.state[1] = this.acceleration
    return this
  }
}
