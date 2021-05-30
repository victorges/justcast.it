import * as livepeer from './livepeer'
import streamstore, { StreamInfo } from './streamstore'

import { uniqueNamesGenerator, adjectives, animals, names } from 'unique-names-generator'

const livepeerApi = new livepeer.API()

const hidConfig = {
  dictionaries: [adjectives, animals, names],
  separator: '-',
}
const humanIdGen = () => uniqueNamesGenerator(hidConfig).toLowerCase()

const streamToInfo = (humanId: string, { id, streamKey, playbackId }: livepeer.Stream): StreamInfo => ({
  humanId,
  streamId: id,
  streamUrl: livepeer.streamUrl(streamKey),
  playbackId,
  playbackUrl: livepeer.playbackUrl(playbackId),
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
