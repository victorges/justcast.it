import Var, { State, Vector } from './var'
import './types'

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
    const lastDrv = this.lastDerivative(time, this.value)
    this.derivatives.set([length - 1], lastDrv as any)
    return this
  }

  abstract lastDerivative(time: number, state: Var<Vector<N, T>>): T
}

class ConstantAcceleration extends BaseSimulator<2> {
  constructor(readonly acceleration: number, state?: Vector<2, number>) {
    super(new Var(state ?? [0, 0]))
  }

  lastDerivative(time: number, state: Var<Vector<2>>): number {
    return this.acceleration
  }
}

function testArr(data: Vector): void {
  const arrr: Var<Vector> = new Var(data)
  arrr.set([1] as const, 4)
  let prop: Prop<typeof data, 1>
  prop = 3
  console.log(arrr, prop)
}

testArr([1, 2, 3, 4])

const varr = new Var({ arr: [1, 2, 3], obj: { a: 1 } })
varr.add(varr.state)
console.log(varr)
console.log(varr.get([1]))
varr.sub(['obj'] as const, { a: 2 })
console.log(varr)
