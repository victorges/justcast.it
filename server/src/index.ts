require('dotenv').config({ path: './.secrets/env'})

import WebSocket from 'ws'
import path from 'path'
import cookie from 'cookie'
import express from 'express'

import streamstore from './streamstore'
import { pipeWsToRtmp } from './ffmpeg'
import { getOrCreateStream } from './streams'

const app = express()

app.get('/api/stream/:humanId', async (req, res) => {
  const id = req.params.humanId
  const info = await streamstore.getByHumanId(id)
  if (!info) {
    res.sendStatus(404)
    return
  }

  const { humanId, playbackId, playbackUrl } = info
  res.json({ humanId, playbackId, playbackUrl })
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
const server = app.listen(port, () => {
  console.log(`listening on port ${port}`)
})

const wss = new WebSocket.Server({
  server,
  path: '/',
})

const streamIdCookieName = 'JustCastId'

wss.on('connection', async function connection(ws, req) {
  console.error('wss', 'connection', req.url)

  const cookies = cookie.parse(req.headers.cookie ?? '')
  const prevStreamId = cookies[streamIdCookieName]
  const info = await getOrCreateStream(prevStreamId)

  const setCookie = prevStreamId ? {} : { [streamIdCookieName]: info.streamId }
  const handshake = {
    type: 'init',
    humanId: info.humanId,
    playbackId: info.playbackId,
    setCookie
  }
  ws.send(JSON.stringify(handshake))

  const mimematch = /mimeType=(.*)/.exec(req.url ?? '') ?? []
  pipeWsToRtmp(ws, info, mimematch.length > 0 ? mimematch[1] : '')
})

wss.on('close', function close() {
  console.log('wss', 'close')
})

module.exports = app
