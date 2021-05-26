require('dotenv').config()

const express = require('express')
const path = require('path')
const app = express()

const WebSocket = require('ws')
const ffmpeg = require('./ffmpeg')
const livepeer = require('./livepeer')

const CWD = process.cwd()

app.get('*', (req, res) => {
  const { url } = req
  const url_segments = url.split('/')
  const url_segments_length = url_segments.length
  const url_last_segment = url_segments[url_segments_length - 1] || 'index.html'
  let file_name = url_last_segment
  if (url_last_segment === 'index.js') {
  } else {
    file_name = 'index.html'
  }
  const file_path = path.join(CWD, 'public', file_name)
  res.sendFile(file_path)
})

// app.use(express.static("public"));

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

  const info = await livepeer.createStream()
  ws.send(JSON.stringify({ playbackId: info.playbackId }))

  ffmpeg.pipeWsToRtmp(ws, info)
})

wss.on('close', function close() {
  console.log('wss', 'close')
})

module.exports = app
