import Var, { State, Vector } from './var'

interface Simulator {
  step(time: number, dt: number, rkIdx: number): void
}

abstract class BaseSimulator<N extends number, T extends State = number>
  implements Simulator
{
  public derivatives: Var<Vector<N, T>>

  constructor(readonly value: Var<Vector<N, T>>) {
    this.derivatives = this.value.copy().zero()
  }

  step(time: number, dt: number, rkIdx: number) {}

  derive(time: number): this {
    const length = this.value.state.length
    for (let i = 1; i < length; i++) {
      this.derivatives.set([i - 1], this.value.get([i]))
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
    const f = this.value.get(['0'])
    return this.acceleration
  }
}

// const varr = new Var({ arr: [1, 2, 3], obj: { a: 1 } })
// varr.add(varr.state)
// console.log(varr)
// // console.log(varr.get([1]))
// // varr.sub(['obj'], { a: 2 })
// console.log(varr)
