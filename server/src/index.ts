require('dotenv').config({ path: './.secrets/env' })

import path from 'path'
import express from 'express'
import cookieParser from 'cookie-parser'
import expressWs from 'express-ws'

import streamstore from './streamstore'
import * as ffmpeg from './ffmpeg'
import { getOrCreateStream } from './streams'
import { extractStreamKey, streamUrl } from './livepeer'

const { app } = expressWs(express())
app.use(cookieParser())

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

const streamIdCookieName = 'JustCastId'
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

app.use('/api', api)

app.ws('/ingest/ws/:streamKey', (ws, req) => {
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

app.ws('*', (ws, req) => {
  console.error('wss', 'connection', req.url)
  ws.close(1002, 'websocket path is /ingest/ws/:streamKey')
})

const CWD = process.cwd()
const FILE_REGEX = /.+\..+/

const isFilename = (str: string) => {
  return FILE_REGEX.test(str)
}

app.get('*', (req, res) => {
  const { url } = req
  const url_segments = url.split('/')
  const url_segments_length = url_segments.length
  const url_last_segment = url_segments[url_segments_length - 1] || ''
  let file_name
  if (isFilename(url_last_segment)) {
    file_name = url_last_segment
  } else {
    file_name = 'index.html'
  }
  const file_path = path.join(CWD, 'dist/public', file_name)
  res.sendFile(file_path)
})

const port = process.env.PORT || 8080
app.listen(port, () => {
  console.log(`listening on port ${port}`)
})

module.exports = app
