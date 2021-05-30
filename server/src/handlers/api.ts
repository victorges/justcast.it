
import express from 'express'

import streamstore from '../streamstore'
import { getOrCreateStream } from '../streams'
import { extractStreamKey } from '../livepeer'
import { streamIdCookieName } from './common'

const api = express.Router()

api.get('/stream/:humanId', async (req, res) => {
  const id = req.params.humanId
  const info = await streamstore.getByHumanId(id)
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
  const {
    humanId,
    streamId,
    streamKey,
    streamUrl
  } = await getOrCreateStream(prevStreamId)

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

export { api }