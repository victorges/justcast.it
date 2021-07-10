import { makeRecord, NumberFields, NumberRecord } from './numRec'

abstract class Var {
  abstract copy(): this
  // These should make changes in-place
  abstract eval(time: number): this
  abstract add(other: this): this
  abstract mult(factor: number): this
}

abstract class BaseVar<T extends string> extends Var {
  readonly state: NumberRecord<T>

  constructor(state: NumberFields<T>) {
    super()
    this.state = makeRecord(state)
  }

  add(other: this): this {
    this.state.add(other.state)
    return this
  }

  mult(factor: number): this {
    this.state.mult(factor)
    return this
  }

  abstract copy(): this
  abstract eval(time: number): this
}

type VelAcc = NumberFields<'velocity' | 'acceleration'>

class ConstantAcceleration extends BaseVar<keyof VelAcc> {
  readonly acceleration: number

  constructor(acceleration: number, state?: VelAcc) {
    super(state ?? { velocity: 0, acceleration })
    this.acceleration = acceleration
  }

  copy(): this {
    return new ConstantAcceleration(this.acceleration, this.state) as this
  }

  eval(time: number): this {
    this.state.velocity = this.state.acceleration
    this.state.acceleration = this.acceleration
    return this
  }
}
