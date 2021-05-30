import express from 'express'

import * as ffmpeg from '../ffmpeg'
import { streamUrl } from '../livepeer'
import { streamIdCookieName } from './common'

const websocket = express.Router()

websocket.ws('/ingest/ws/:streamKey', (ws, req) => {
  console.log('wss', 'connection', req.url)

  const streamId = req.cookies[streamIdCookieName] as string
  const streamKey = req.params.streamKey
  const mimeType = req.query['mimeType']?.toString()

  if (!streamId || !streamKey) {
    ws.close(1002, 'must send streamId on cookie and streamKey on path')
    return
  }

  const opts: ffmpeg.Opts = {
    streamId,
    streamUrl: streamUrl(streamKey),
    mimeType: mimeType,
  }
  ffmpeg.pipeWsToRtmp(ws, opts)
})

websocket.ws('*', (ws, req) => {
  console.error('wss', 'connection', req.url)
  ws.close(1002, 'websocket path is /ingest/ws/:streamKey')
})

export { websocket }