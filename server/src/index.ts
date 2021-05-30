require('dotenv').config({ path: './.secrets/env' })

import WebSocket from 'ws'
import path from 'path'
import cookie from 'cookie'
import express from 'express'
import cookieParser from 'cookie-parser'

import streamstore from './streamstore'
import * as ffmpeg from './ffmpeg'
import { getOrCreateStream } from './streams'
import { extractStreamKey, streamUrl } from './livepeer'

const app = express()
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
const server = app.listen(port, () => {
  console.log(`listening on port ${port}`)
})

const wss = new WebSocket.Server({
  server,
  path: '/',
})

wss.on('connection', async function connection(ws, req) {
  console.error('wss', 'connection', req.url)

  const cookies = cookie.parse(req.headers.cookie ?? '')

  const streamId = cookies[streamIdCookieName]
  const streamKey = /streamKey=([^?&]+)/.exec(req.url ?? '') ?? []
  const mimematch = /mimeType=([^?&]+)/.exec(req.url ?? '') ?? []

  if (!streamId || streamKey.length == 0) {
    ws.close(1002, 'must send streamId on cookie and streamKey on querystring')
  }
  const opts: ffmpeg.Opts = {
    streamId,
    streamUrl: streamUrl(streamKey[1]),
    mimeType: mimematch.length > 0 ? mimematch[1] : undefined,
  }
  ffmpeg.pipeWsToRtmp(ws, opts)
})

wss.on('close', function close() {
  console.log('wss', 'close')
})

module.exports = app
