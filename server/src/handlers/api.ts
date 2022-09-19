import express from 'express'

import { getOrCreateStream, getStreamByHumanId } from '../clients/streams'
import { extractStreamKey } from '../clients/livepeer'
import { streamIdCookieName } from './common'

const api = express.Router()

api.get('/stream/:humanId', async (req, res) => {
  const id = req.params.humanId
  const info = await getStreamByHumanId(id)
  if (!info) {
    res.sendStatus(404)
    return
  }

  const { humanId, playbackId, playbackUrl } = info
  res.json({ humanId, playbackId, playbackUrl })
})

const cookieMaxAgeMs = 7 * 24 * 60 * 60 * 1000

api.post('/stream/init', async (req, res) => {
  const prevStreamId = req.cookies[streamIdCookieName]
  const { humanId, streamId, streamKey, streamUrl } = await getOrCreateStream(
    prevStreamId
  )

  if (!prevStreamId) {
    res.cookie(streamIdCookieName, streamId, {
      maxAge: cookieMaxAgeMs,
      httpOnly: true,
    })
  }
  res.json({
    humanId,
    streamKey: streamKey ?? extractStreamKey(streamUrl),
  })
})

api.all('*', (req, res) => {
  res.status(404).json({
    code: 'not_found',
    message: `No API at path ${req.path}`,
  })
})

export { api }
