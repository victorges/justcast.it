import express from 'express'

import * as ffmpeg from '../clients/ffmpeg'
import { streamUrl } from '../clients/livepeer'
import { streamIdCookieName } from './common'

const websocket = express.Router()

websocket.ws('/ingest/ws/:streamKey', (ws, req) => {
  console.log('wss', 'connection', req.url)

  const ignoreCookies = req.query['ignoreCookies'] === 'true'
  const streamId = ignoreCookies
    ? null
    : (req.cookies[streamIdCookieName] as string)
  const streamKey = req.params.streamKey
  const mimeType = req.query['mimeType']?.toString()

  if (!streamKey) {
    ws.close(1002, 'must send streamKey on path')
    return
  }

  const opts: ffmpeg.Opts = {
    logNs: streamId ? `stream-${streamId}` : `streamKey-${streamKey}`,
    streamUrl: streamKey.indexOf('://') > 0 ? streamKey : streamUrl(streamKey),
    mimeType,
  }
  ffmpeg.pipeWsToRtmp(ws, opts)
})

websocket.ws('*', (ws, req) => {
  console.error('wss', 'connection', req.url)
  ws.close(1002, 'websocket path is /ingest/ws/:streamKey')
})

export { websocket }
