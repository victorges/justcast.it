import { copyToClipboard } from '../clipboard'
import cast from './cast'
import isLocalOrIp from './util/isLocalOrIp'

const { body } = document

const _video = document.getElementById('video') as HTMLVideoElement

const _canvas = document.getElementById('canvas') as HTMLCanvasElement

function resizeCanvas() {
  const { innerWidth, innerHeight } = window

  _canvas.width = innerWidth
  _canvas.height = innerHeight
}

window.addEventListener('resize', () => {
  resizeCanvas()
})

resizeCanvas()

// @ts-ignore
const _canvas_stream = _canvas.captureStream()

const _canvas_ctx = _canvas.getContext('2d')

let _stream: MediaStream

const _playback_url = document.getElementById('playback-url')
_playback_url.onclick = () => {
  copyToClipboard(_playback_url.innerText)
}

const _record_container = document.getElementById('record-container')
_record_container.style.display = 'block'
_record_container.onclick = () => {
  if (_curr_cast) {
    stopRecording()
  } else {
    if (_stream) {
      startRecording(_stream)
    }
  }
}

const _record = document.getElementById('record')

const _media_container = document.getElementById('media-container')
_media_container.style.display = 'block'
_media_container.onclick = async () => {
  if (_media_display) {
    refreshMediaToUser()
  } else {
    refreshMediaToDisplay()
  }
}

const _media = document.getElementById('media')

let _media_display = false

let _media_display_returned = false

let _record_frash_dim = false

let _microphone_stream: MediaStream

const MIN_RETRY_THRESHOLD = 60 * 1000 // 1 min

// set background to transparent when inside iframe
if (window.location !== window.parent.location) {
  body.style.background = 'none transparent'
}

const { hostname, pathname, port, protocol } = location

console.log('protocol', protocol)
console.log('hostname', hostname)
console.log('port', port)
console.log('pathname', pathname)

const is_local_or_ip = isLocalOrIp(hostname)

let _video_stream: MediaStream = null
let _curr_cast: CastSession = null

let _playback_id: string = null
let _stream_key: string | undefined

async function initStreamData() {
  const segments = location.pathname.substr(1).split('/', 2)
  if (segments.length == 2 && segments[0] === 'to') {
    _stream_key = segments[1]
    _playback_id = undefined
    return
  }

  const res = await fetch(`/api/stream/init`, { method: 'POST' })

  if (res.status !== 200) {
    throw new Error('Bad init API status code: ' + res.status)
  }

  const { humanId, streamKey } = await res.json()
  console.log('streaming to', humanId)

  _playback_id = humanId
  _stream_key = streamKey

  const portStr = is_local_or_ip ? `:${port}` : ''
  _playback_url.innerText = `${protocol}//${hostname}${portStr}/${humanId}`
}

type Transport = 'wrtc' | 'ws'
const allTransports: Transport[] = ['wrtc', 'ws']

function requestedTransport() {
  const match = location.search.match(/transport=([^&]+)/)
  if (!match) {
    return null
  }
  const asTransp = match[1] as Transport
  return allTransports.indexOf(asTransp) >= 0 ? asTransp : null
}

function startRecording(stream: MediaStream) {
  if (_curr_cast || !window.MediaRecorder || !_stream_key) {
    return
  }
  console.log('startRecording')

  const _requested_transport = requestedTransport()

  const is_h264_mime_type = cast.wsMimeType.indexOf('h264') > 0

  const transport = _requested_transport ?? (is_h264_mime_type ? 'ws' : 'wrtc')

  const connect_time = Date.now()

  let new_cast: CastSession
  if (transport === 'wrtc') {
    new_cast = cast.viaWebRTC(stream, _stream_key)
  } else {
    new_cast = cast.viaWebSocket(stream, _stream_key, !_playback_id)
  }

  _curr_cast = new_cast

  new_cast.onError = (isTransient) => {
    if (_curr_cast !== new_cast) {
      return
    }
    stopRecording()
    _curr_cast = null

    const connection_age = Date.now() - connect_time
    const should_retry = isTransient && connection_age >= MIN_RETRY_THRESHOLD
    if (should_retry) {
      startRecording(stream)
    }
  }

  _record.style.background = '#dd0000'
  _record.style.borderColor = '#dd0000'

  _video.style.opacity = '1'

  if (_playback_id) {
    _playback_url.classList.add('visible')
  }

  _record_flash_interval = setInterval(() => {
    _record_frash_dim = !_record_frash_dim

    if (_record_frash_dim) {
      _record.style.opacity = '0'
    } else {
      _record.style.opacity = '1'
    }
  }, 1000)
}

let _record_flash_interval

function stopRecording() {
  if (!_curr_cast) {
    return
  }
  console.log('stopRecording')

  _curr_cast.close()
  _curr_cast = null

  _record.style.opacity = '1'
  _record.style.background = '#dddddd'
  _record.style.borderColor = '#dddddd'

  _video.style.opacity = '0.5'

  clearInterval(_record_flash_interval)
}

async function setMicrophoneStream(): Promise<void> {
  console.log('setMicrophoneStream')
  const stream = new MediaStream()

  try {
    const microphone_stream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: { echoCancellation: true, noiseSuppression: true },
    })

    _microphone_stream = microphone_stream

    const microphone_tracks = _microphone_stream.getTracks()

    for (const microphone_track of microphone_tracks) {
      stream.addTrack(microphone_track)
    }
  } catch (err) {
    console.log('setMicrophoneStream', 'err', err.message)
  }

  const canvas_tracks = _canvas_stream.getTracks()

  for (const canvas_track of canvas_tracks) {
    stream.addTrack(canvas_track)
  }

  _stream = stream
}

async function setMediaToDisplay(): Promise<MediaStream> {
  console.log('setMediaToDisplay')

  _media_display = true
  _media_display_returned = false

  let stream: MediaStream

  try {
    stream = await navigator.mediaDevices
      // @ts-ignore
      .getDisplayMedia({ audio: true, video: true })
  } catch (err) {
    console.log('navigator', 'getDisplayMedia', 'error', err)
    _media_display = false
    return
  }

  _media_display_returned = true

  // AD HOC
  // return to user media if user stopped recording
  const media_tracks = stream.getTracks()
  const first_media_track = media_tracks[0]
  if (first_media_track) {
    const end_listener = async () => {
      first_media_track.removeEventListener('ended', end_listener)
      refreshMediaToUser()
    }
    first_media_track.addEventListener('ended', end_listener)
  }

  setVideoStream(stream)

  _media_container.style.borderRadius = '30px'
  _media.style.borderRadius = '15px'

  return stream
}

async function refreshMediaToDisplay(): Promise<void> {
  await setMediaToDisplay()
}

async function setMediaToUser(): Promise<MediaStream> {
  console.log('setMediaToUser')

  if (_media_display_returned) {
    // AD HOC
    // stop browser recording
    _video_stream.getTracks().forEach((track) => track.stop())
  }

  _media_display = false

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    })

    setVideoStream(stream)

    _media.style.borderRadius = '3px'
    _media_container.style.borderRadius = '6px'

    return stream
  } catch (err) {
    console.log('navigator', 'mediaDevices', 'err', err)
  }
}

async function refreshMediaToUser(): Promise<void> {
  await setMediaToUser()
}

function setVideoStream(stream: MediaStream): void {
  _video_stream = stream
  _video.srcObject = stream
}

_video.style.opacity = '0.5'
_video.style.transition = 'opacity 0.2s linear'

_video.volume = 0

initStreamData()

setMediaToUser()
// setMediaToDisplay()

function setupAnimationFrame() {
  requestAnimationFrame(() => {
    const { innerWidth, innerHeight } = window

    const { videoWidth, videoHeight } = _video

    const video_ratio = videoWidth / videoHeight

    let x: number = 0
    let y: number = 0

    let width: number
    let height: number

    if (innerWidth > innerHeight) {
      height = innerHeight
      width = height * video_ratio
      x = (innerWidth - width) / 2
    } else {
      width = innerWidth
      height = width / video_ratio
      y = (innerHeight - height) / 2
    }

    _canvas_ctx.drawImage(_video, x, y, width, height)

    setupAnimationFrame()
  })
}

setupAnimationFrame()

setMicrophoneStream()
