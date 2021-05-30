import isIp from 'is-ip'

import { copyToClipboard } from './clipboard'

const isLocalHost = (hostname) => {
  return hostname === 'localhost' || hostname.endsWith('.localhost')
}

const { body } = document

const video = document.getElementById('video')
const playbackUrl = document.getElementById('playbackUrl')

const record_container = document.getElementById('record-container')
const record = document.getElementById('record')

playbackUrl.onclick = () => {
  copyToClipboard(playbackUrl.innerText)
}

// @ts-ignore
const player = videojs(video)

// set background to transparent when inside iframe
if (window.location !== window.parent.location) {
  body.style.background = 'none transparent'
}

const { hostname, pathname, port, protocol } = location

console.log('protocol', protocol)
console.log('hostname', hostname)
console.log('pathname', pathname)

const localhost = isLocalHost(hostname) || isIp(hostname)

const secure = protocol === 'https:'

const transmitter = pathname === '/'
const receiver = !transmitter

let socket: WebSocket = null
let connected = false
let connecting = false

let _stream: MediaStream = null

let recording = false

let _playbackId: string = null
let _streamKey: string | undefined

let _mimeType: string | undefined

function initMimeType() {
  // @ts-ignore
  if (!window.MediaRecorder) return

  const types = [
    'video/webm;codecs=h264',
    'video/webm',
    'video/webm;codecs=opus',
    'video/webm;codecs=vp8',
    'video/webm;codecs=daala',
    'video/mpeg',
  ]

  for (const type of types) {
    // @ts-ignore
    const supported = MediaRecorder.isTypeSupported(type)
    if (supported) {
      _mimeType = type
      break
    }
  }

  console.log('using mimeType', _mimeType)
}

async function initStreamData() {
  const res = await fetch(`/api/stream/init`, { method: 'POST' })
  if (res.status !== 200) {
    throw new Error('Bad init API status code: ' + res.status)
  }

  const { humanId, streamKey } = await res.json()
  console.log('streaming to', humanId)

  _playbackId = humanId
  _streamKey = streamKey

  const portStr = localhost ? `:${port}` : ''
  playbackUrl.innerText = `${protocol}//${hostname}${portStr}/${humanId}`
}

function send(data) {
  if (!connected) {
    throw new Error('WebSocket is not connected')
  }
  socket.send(data)
}

function connect(onOpen: (event: Event) => void, onClose: (event: CloseEvent) => void) {
  connecting = true

  const protocol = !localhost && secure ? 'wss' : 'ws'
  const portStr = localhost ? `:${port}` : ''
  const url = `${protocol}://${hostname}${portStr}/ingest/ws/${_streamKey}?mimeType=${_mimeType}`

  console.log('socket', 'url', url)

  socket = new WebSocket(url)

  socket.addEventListener('open', function (event) {
    console.log('socket', 'open')

    connected = true
    connecting = false
    onOpen(event)
  })

  socket.addEventListener('close', function (event) {
    console.log('socket', 'close', event.code, event.reason)

    connected = false
    connecting = false

    onClose(event)
  })

  socket.addEventListener('message', (event) => {
    const { data: message } = event
    const data = JSON.parse(message)

    console.log('socket', 'message', data)
  })

  socket.addEventListener('error', (event) => {
    console.log('socket', 'error', event)
  })
}

function disconnect(code?: number) {
  socket.close(code)
  socket = null
}

let media_recorder = null

let record_frash_dim = false

const minRetryThreshold = 60 * 1000 // 1 min

function start_recording(stream: MediaStream) {
  // console.log('start_recording', stream)
  // @ts-ignore
  if (recording || !window.MediaRecorder || !_mimeType || !_streamKey) return

  recording = true

  // @ts-ignore
  media_recorder = new MediaRecorder(stream, {
    mimeType: _mimeType,
    videoBitsPerSecond: 3 * 1024 * 1024,
  })
  media_recorder.start(2000)

  const connectTime = Date.now()
  connect(openEvent => {
    media_recorder.ondataavailable = function (event) {
      const { data } = event
      if (recording && connected) send(data)
    }
  }, closeEvent => {
    if (!recording) return
    stop_recording()

    const connectionAge = Date.now() - connectTime
    const shouldRetry = closeEvent.code === 1006 && connectionAge >= minRetryThreshold
    if (shouldRetry) {
      console.log('restarting streaming due to ws 1006 error')
      start_recording(stream)
    }
  })

  record.style.background = '#dd0000'

  video.style.opacity = '1'

  playbackUrl.classList.add('visible')

  record_flash_interval = setInterval(() => {
    record_frash_dim = !record_frash_dim

    if (record_frash_dim) {
      record.style.opacity = '0'
    } else {
      record.style.opacity = '1'
    }
  }, 1000)
}

let record_flash_interval

function stop_recording() {
  recording = false

  media_recorder.stop()
  disconnect(1000)

  record.style.opacity = '1'
  record.style.background = '#dddddd'

  video.style.opacity = '0.5'

  clearInterval(record_flash_interval)
}

if (transmitter) {
  video.style.opacity = '0.5'
  video.style.transition = 'opacity 0.2s linear'

  player.volume(0)

  initMimeType()
  initStreamData()

  navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then((stream) => {
      _stream = stream

      const video = player.tech().el()
      video.srcObject = stream
    })
    .catch((err) => {
      console.log('navigator', 'mediaDevices', 'err', err)
    })

  record_container.style.display = 'block'

  record_container.onclick = () => {
    if (recording) {
      stop_recording()
    } else {
      start_recording(_stream)
    }
  }
} else {
  player.volume(1)
  player.controls(true)

  const humanId = pathname.substr(1)
  fetch(`/api/stream/${humanId}`)
    .then((res) => {
      if (res.status === 200) {
        return res.json()
      }
      const playbackUrl = `https://cdn.livepeer.com/hls/${humanId}/index.m3u8`
      return { playbackUrl }
    })
    .then((info) => {
      player.src({
        src: info.playbackUrl,
        type: 'application/x-mpegURL',
        withCredentials: false,
      })
    })
}
