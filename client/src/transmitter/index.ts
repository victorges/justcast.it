import isIp from 'is-ip'

import { copyToClipboard } from '../clipboard'

const isLocalHost = (hostname) => {
  return hostname === 'localhost' || hostname.endsWith('.localhost')
}

const { body } = document

const video = document.getElementById('video')
const playbackUrl = document.getElementById('playbackUrl')

const record_container = document.getElementById('record-container')
const record = document.getElementById('record')

const media_container = document.getElementById('media-container')
const media = document.getElementById('media')

let media_display = false

let media_display_returned = false

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
console.log('port', port)
console.log('pathname', pathname)

const localhost = isLocalHost(hostname) || isIp(hostname)

const secure = protocol === 'https:'

let socket: WebSocket = null
let connected = false
let connecting = false

let _stream: MediaStream = null

let recording = false

let _playbackId: string = null
let _streamKey: string | undefined

let _mimeType: string | undefined

function initMimeType() {
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
    'video/mp4',
  ]

  for (const type of types) {
    const supported = MediaRecorder.isTypeSupported(type)
    if (supported) {
      _mimeType = type
      break
    }
  }

  console.log('_mimeType', _mimeType)
}

async function initStreamData() {
  const segments = location.pathname.substr(1).split('/', 2)
  if (segments.length == 2 && segments[0] === 'to') {
    _streamKey = segments[1]
    _playbackId = undefined
    return
  }

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
  socket.send(data)
}

function querystring(params: Record<string, any>) {
  const escape = encodeURIComponent
  const raw = Object.keys(params)
    .filter((k) => !!params[k])
    .map((k) => escape(k) + '=' + escape(params[k].toString()))
    .join('&')
  return raw.length === 0 ? '' : '?' + raw
}

function connect(
  onOpen: (event: Event) => void,
  onClose: (event: CloseEvent) => void
) {
  connecting = true

  const protocol = !localhost && secure ? 'wss' : 'ws'
  const portStr = localhost ? `:${port}` : ''
  const query = querystring({
    mimeType: _mimeType,
    ignoreCookies: !_playbackId,
  })
  const url = `${protocol}://${hostname}${portStr}/ingest/ws/${_streamKey}${query}`

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
  if (recording || !window.MediaRecorder || !_streamKey) {
    return
  }

  console.log('start_recording')

  recording = true

  setup_media_recorder(stream)

  const connectTime = Date.now()
  connect(
    (openEvent) => {
      if (recording) {
        start_media_recorder()
      }
    },
    (closeEvent) => {
      if (!recording) {
        return
      }

      const { code } = closeEvent

      if (code !== 1000) {
        stop_recording()
      }

      const connectionAge = Date.now() - connectTime
      const shouldRetry = code === 1006 && connectionAge >= minRetryThreshold
      if (shouldRetry) {
        console.log('restarting streaming due to ws 1006 error')
        start_recording(stream)
      }
    }
  )

  record.style.background = '#dd0000'
  record.style.borderColor = '#dd0000'

  video.style.opacity = '1'

  if (_playbackId) playbackUrl.classList.add('visible')

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

  console.log('stop_recording')

  recording = false

  media_recorder.ondataavailable = null
  stop_media_recorder()

  disconnect(1000)

  record.style.opacity = '1'
  record.style.background = '#dddddd'
  record.style.borderColor = '#dddddd'

  video.style.opacity = '0.5'

  clearInterval(record_flash_interval)
}

function refresh_recording(stream: MediaStream): void {
  if (recording && connected) {
    stop_recording()
    start_recording(stream)
  }
}

async function set_media_to_display(): Promise<MediaStream> {
  console.log('set_media_to_display')

  media_display = true
  media_display_returned = false

  let stream: MediaStream

  try {
    stream = await navigator.mediaDevices
      // @ts-ignore
      .getDisplayMedia({ audio: true, video: true })
  } catch (err) {
    console.log('navigator', 'getDisplayMedia', 'error', err)
    media_display = false
    return
  }

  media_display_returned = true

  // AD HOC
  // return to user media if user stopped recording
  const media_tracks = stream.getTracks()
  const first_media_track = media_tracks[0]
  if (first_media_track) {
    const end_listener = async () => {
      first_media_track.removeEventListener('ended', end_listener)
      refresh_media_to_user()
    }
    first_media_track.addEventListener('ended', end_listener)
  }

  set_video_stream(stream)

  media_container.style.borderRadius = '30px'
  media.style.borderRadius = '15px'

  return stream
}

async function refresh_media_to_display(): Promise<void> {
  const stream = await set_media_to_display()
  refresh_recording(stream)
}

async function set_media_to_user(): Promise<MediaStream> {
  console.log('set_media_to_user')

  if (media_display_returned) {
    // stop browser recording
    _stream.getTracks().forEach((track) => track.stop())
  }

  media_display = false

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: { echoCancellation: true, noiseSuppression: true },
    })

    set_video_stream(stream)

    media.style.borderRadius = '3px'
    media_container.style.borderRadius = '6px'

    return stream
  } catch (err) {
    console.log('navigator', 'mediaDevices', 'err', err)
  }
}

async function refresh_media_to_user(): Promise<void> {
  const stream = await set_media_to_user()
  refresh_recording(stream)
}

function setup_media_recorder(stream: MediaStream): void {
  if (media_recorder) {
    media_recorder.ondataavailable = null
    stop_media_recorder()
  }

  media_recorder = new MediaRecorder(stream, {
    mimeType: _mimeType,
    audioBitsPerSecond: 128 * 1024,
    videoBitsPerSecond: 3 * 1024 * 1024,
  })

  media_recorder.ondataavailable = function (event) {
    const { data } = event
    if (recording && connected) {
      send(data)
    }
  }
}

const MEDIA_RECORDER_T = 2000

let media_recorder_started = false

function start_media_recorder(): void {
  if (media_recorder_started) {
    return
  }
  console.log('start_media_recorder')
  media_recorder_started = true
  media_recorder.start(MEDIA_RECORDER_T)
}

function stop_media_recorder(): void {
  if (!media_recorder_started) {
    return
  }
  media_recorder_started = false
  console.log('stop_media_recorder')
  if (media_recorder.state === 'inactive') {
    return
  }
  media_recorder.stop()
}

function set_video_stream(stream: MediaStream): void {
  _stream = stream

  const video = player.tech().el()
  video.srcObject = stream
}

video.style.opacity = '0.5'
video.style.transition = 'opacity 0.2s linear'

player.volume(0)

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
    refresh_media_to_user()
  } else {
    refresh_media_to_display()
  }
}
