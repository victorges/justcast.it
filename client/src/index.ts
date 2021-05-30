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

let _stream = null

let recording = false

let _playbackId = null

let mimeType: string | undefined = undefined

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
      mimeType = type
      break
    }
  }

  console.log('using mimeType', mimeType)
}

function send(data) {
  if (!connected) {
    throw new Error('WebSocket is not connected')
  }
  socket.send(data)
}

function connect(onConnected: () => void) {
  connecting = true

  let url

  if (localhost) {
    url = `ws://${hostname}:8080`
  } else {
    if (secure) {
      url = `wss://${hostname}:443`
    } else {
      url = `ws://${hostname}:8080`
    }
  }
  url += `?mimeType=${mimeType}`

  console.log('socket', 'url', url)

  socket = new WebSocket(url)

  socket.addEventListener('open', function (event) {
    console.log('socket', 'open')
  })

  socket.addEventListener('close', function (event) {
    console.log('socket', 'close:', event.code, event.reason)

    connected = false
    connecting = false

    if (recording) {
      stop_recording()
    }
  })

  socket.addEventListener('message', (event) => {
    const { data: message } = event
    const data = JSON.parse(message)

    console.log('socket', 'message', data)

    const { type, playbackId, humanId, setCookie } = data
    if (type !== 'init') return disconnect(1002)

    // we are only really connected when we receive the handshake msg from the server
    connected = true
    connecting = false

    for (const name in setCookie) {
      document.cookie = `${name}=${setCookie[name]}`
    }
    _playbackId = playbackId

    playbackUrl.innerText = `${protocol}//${hostname}${
      localhost ? `:${port}` : ''
    }/${humanId || playbackId}`

    onConnected()
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

function start_recording(stream) {
  // console.log('start_recording', stream)
  // @ts-ignore
  if (!window.MediaRecorder || !mimeType) return

  recording = true

  // @ts-ignore
  media_recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 3 * 1024 * 1024,
  })

  media_recorder.start(2000)

  connect(() => {
    media_recorder.ondataavailable = function (event) {
      const { data } = event
      if (recording) send(data)
    }
  })

  record.style.background = '#dd0000'

  video.style.opacity = '1'

  playbackUrl.classList.add('visible')

  if (_playbackId) {
    playbackUrl.classList.add('visible')
  }

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
