import Var, { State, stateSet, Vector } from './var'

interface Simulator {
  step(time: number, dt: number, rkIdx: number): void
}

abstract class BaseSimulator<N extends number, T extends State = number>
  implements Simulator
{
  public derivatives: Var<Vector<N, T>>

  constructor(readonly value: Var<Vector<N, T>>) {
    this.derivatives = this.value.copy().mult(0)
  }

  step(time: number, dt: number, rkIdx: number) {}

  derive(time: number): this {
    const length = this.value.state.length
    for (let i = 1; i < length; i++) {
      stateSet(this.derivatives.state[i - 1], this.value.state[i])
    }
    const lastDrv = this.lastDerivative(time, this.value.state)
    this.derivatives.state[length - 1] = lastDrv
    return this
  }

  abstract lastDerivative(time: number, state: Vector<N, T>): T
}

class ConstantAcceleration extends BaseSimulator<2> {
  constructor(readonly acceleration: number, state?: Vector<2, number>) {
    super(new Var(state ?? [0, 0]))
  }

  lastDerivative(): number {
    const f = this.value.get('0')
    return this.acceleration
  }
}
