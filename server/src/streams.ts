import * as livepeer from './livepeer'
import streamstore, { StreamInfo } from './streamstore'

import { uniqueNamesGenerator, adjectives, animals, names } from 'unique-names-generator'

const livepeerApi = new livepeer.API()

const hidConfig = {
  dictionaries: [adjectives, animals, names],
  separator: '-',
}
const humanIdGen = () => uniqueNamesGenerator(hidConfig).toLowerCase()

const streamToInfo = (humanId: string, stream: livepeer.Stream): StreamInfo => ({
  humanId,
  streamId: stream.id,
  streamKey: stream.streamKey,
  streamUrl: livepeer.streamUrl(stream.streamKey),
  playbackId: stream.playbackId,
  playbackUrl: livepeer.playbackUrl(stream.playbackId),
  stream: stream
})

export async function getOrCreateStream(prevStreamId?: string): Promise<StreamInfo> {
  if (prevStreamId) {
    const info = await streamstore.getByStreamId(prevStreamId)
    if (info) return info
  }

  const humanId = humanIdGen()
  const stream = prevStreamId
    ? await livepeerApi.getStream(prevStreamId)
    : await livepeerApi.createStream(`justcast-it-${humanId}`)

  const info = streamToInfo(humanId, stream)
  await streamstore.create(info)
  return info
}
