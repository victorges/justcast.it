import livepeer from './livepeer'
import streamstore, { StreamInfo } from './streamstore'

import { uniqueNamesGenerator, adjectives, animals, names } from 'unique-names-generator'

const hidConfig = {
  dictionaries: [adjectives, animals, names],
  separator: '-',
}
const humanIdGen = () => uniqueNamesGenerator(hidConfig).toLowerCase()

async function getOrCreateStream(prevStreamId: string) {
  if (prevStreamId) {
    const info = await streamstore.getByStreamId(prevStreamId)
    if (info) {
      return info
    }
  }

  const humanId = humanIdGen()
  const lpInfo = prevStreamId
    ? await livepeer.getStream(prevStreamId)
    : await livepeer.createStream(`justcast-it-${humanId}`)

  const info = { ...lpInfo, humanId }
  await streamstore.create(humanId, info)
  return info
}

export { getOrCreateStream }
