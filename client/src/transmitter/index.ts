import isIp from 'is-ip'

import { copyToClipboard } from '../clipboard'

const isLocalHost = (hostname) => {
  return hostname === 'localhost' || hostname.endsWith('.localhost')
}

const { body } = document

let _stream: MediaStream = null

let media_recorder = null

let record_frash_dim = false

const video = document.getElementById('video') as HTMLVideoElement
const playbackUrl = document.getElementById('playbackUrl')

const record_container = document.getElementById('record-container')
const record = document.getElementById('record')

const media_container = document.getElementById('media-container')
const media = document.getElementById('media')

const canvas = document.getElementById('canvas') as HTMLCanvasElement

const ctx = canvas.getContext('2d')

function resize_canvas(): void {
  const { innerWidth, innerHeight } = window
  canvas.width = innerWidth
  canvas.height = innerHeight
}

resize_canvas()

window.addEventListener('resize', () => {
  resize_canvas()
})

function set_animation(): void {
  requestAnimationFrame(animate)
}

function animate() {
  const { innerWidth, innerHeight } = window
  const { videoWidth, videoHeight } = video
  const p = videoWidth / videoHeight
  const width = innerWidth
  const height = width / p
  const x = (innerWidth - width) / 2
  const y = (innerHeight - height) / 2
  ctx.drawImage(video, x, y, width, height)
  set_animation()
}

set_animation()

// @ts-ignore
_stream = canvas.captureStream()

setup_media_recorder(_stream)

let media_display = false

playbackUrl.onclick = () => {
  copyToClipboard(playbackUrl.innerText)
}

// set background to transparent when inside iframe
if (window.location !== window.parent.location) {
  body.style.background = 'none transparent'
}

const { hostname, pathname, port, protocol } = location

console.log('protocol', protocol)
console.log('hostname', hostname)
console.log('port', port)
console.log('pathname', pathname)

const localhost = isLocalHost(hostname) || isIp(hostname)

const secure = protocol === 'https:'

let socket: WebSocket = null
let connected = false
let connecting = false

let recording = false

let _playbackId: string = null
let _streamKey: string | undefined

let _mimeType: string | undefined

function initMimeType() {
  // @ts-ignore
  if (!window.MediaRecorder) {
    return
  }

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

function connect(
  onOpen: (event: Event) => void,
  onClose: (event: CloseEvent) => void
) {
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

    connecting = false
  })
}

function disconnect(code?: number) {
  socket.close(code)
  socket = null
}

const minRetryThreshold = 60 * 1000 // 1 min

const MEDIA_RECORDER_T = 2000

function start_recording(stream: MediaStream) {
  console.log('start_recording')
  // @ts-ignore
  if (recording || !window.MediaRecorder || !_mimeType || !_streamKey) return

  recording = true

  media_recorder.start(MEDIA_RECORDER_T)

  const connectTime = Date.now()
  connect(
    (openEvent) => {},
    (closeEvent) => {
      if (!recording) {
        return
      }

      const { code } = closeEvent

      stop_recording()

      const connectionAge = Date.now() - connectTime
      const shouldRetry =
        code === 1011 || (code === 1006 && connectionAge >= minRetryThreshold)
      if (shouldRetry) {
        console.log('restarting streaming due to ws 1006 error')
        start_recording(stream)
      }
    }
  )

  record.style.background = '#dd0000'
  record.style.borderColor = '#dd0000'

  canvas.style.opacity = '1'

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
  if (!recording) {
    return
  }

  recording = false

  media_recorder.stop()

  disconnect(1000)

  record.style.opacity = '1'
  record.style.background = '#dddddd'
  record.style.borderColor = '#dddddd'

  canvas.style.opacity = '0.5'

  clearInterval(record_flash_interval)
}

function refresh_recording(stream: MediaStream): void {
  if (recording) {
    stop_recording()
  }

  start_recording(stream)
}

async function set_media_to_display(): Promise<MediaStream> {
  console.log('set_media_to_display')
  media_display = true

  media.style.borderRadius = '3px'
  media_container.style.borderRadius = '6px'

  const stream = await navigator.mediaDevices
    // @ts-ignore
    .getDisplayMedia({ audio: true, video: true })

  set_video_stream(stream)

  const media_tracks = stream.getTracks()
  const first_media_track = media_tracks[0]
  if (first_media_track) {
    first_media_track.addEventListener('ended', () => {
      set_media_to_user()
    })
  }

  return stream
}

async function set_media_to_user(): Promise<MediaStream> {
  console.log('set_media_to_user')
  media_display = false

  media_container.style.borderRadius = '30px'
  media.style.borderRadius = '15px'

  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  })

  set_video_stream(stream)

  return stream
}

function setup_media_recorder(stream: MediaStream): void {
  console.log('setup_media_recorder', stream)
  // @ts-ignore
  media_recorder = new MediaRecorder(stream, {
    mimeType: _mimeType,
    videoBitsPerSecond: 3 * 1024 * 1024,
  })

  media_recorder.ondataavailable = function (event) {
    const { data } = event
    if (recording && connected) {
      send(data)
    }
  }
}

function set_video_stream(stream: MediaStream): void {
  video.srcObject = stream
}

canvas.style.opacity = '0.5'
video.style.transition = 'opacity 0.2s linear'

video.volume = 0

initMimeType()
initStreamData()

set_media_to_user()
// set_media_to_display()

record_container.style.display = 'block'

record_container.onclick = () => {
  if (recording) {
    stop_recording()
  } else {
    start_recording(_stream)
  }
}

media_container.style.display = 'block'

media_container.onclick = async () => {
  if (media_display) {
    await set_media_to_user()
  } else {
    await set_media_to_display()
  }
}
