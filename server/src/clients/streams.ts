import * as livepeer from './livepeer'

import {
  uniqueNamesGenerator,
  adjectives,
  animals,
  names,
} from 'unique-names-generator'

interface StreamInfo {
  humanId: string
  streamId: string
  streamKey?: string
  streamUrl: string
  playbackId: string
  playbackUrl: string
  stream?: livepeer.Stream
}

const livepeerApi = new livepeer.API()

const hidConfig = {
  dictionaries: [adjectives, animals, names],
  separator: '-',
}
const humanIdGen = () => uniqueNamesGenerator(hidConfig).toLowerCase()

const streamToInfo = (
  humanId: string,
  stream: livepeer.Stream
): StreamInfo => ({
  humanId,
  streamId: stream.id,
  streamKey: stream.streamKey,
  streamUrl: livepeer.streamUrl(stream.streamKey),
  playbackId: stream.playbackId,
  playbackUrl: livepeer.playbackUrl(stream.playbackId),
  stream: stream,
})

const toStreamName = (humanId: string) => `justcast-it-${humanId}`
const extractHumanId = (streamName: string) => {
  const matches = /^justcast-it-(.+)$/.exec(streamName)
  return matches ? matches[1] : null
}

export async function getOrCreateStream(
  prevStreamId?: string
): Promise<StreamInfo> {
  if (prevStreamId) {
    const stream = await livepeerApi.getStreamById(prevStreamId)
    const humanId = extractHumanId(stream?.name ?? '')
    if (stream && humanId) {
      return streamToInfo(humanId, stream)
    }
  }

  const humanId = humanIdGen()
  const stream = await livepeerApi.createStream(toStreamName(humanId))

  return streamToInfo(humanId, stream)
}

export async function getStreamByHumanId(humanId: string) {
  const stream = await livepeerApi.getStreamByName(toStreamName(humanId))
  return !stream ? null : streamToInfo(humanId, stream)
}
