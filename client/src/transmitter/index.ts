import { copyToClipboard } from '../clipboard'
import cast from './cast'

type Transport = 'wrtc' | 'ws'

const { body } = document

const _video = document.getElementById('video') as HTMLVideoElement

const _canvas = document.getElementById('canvas') as HTMLCanvasElement

function resizeCanvas() {
  const { innerWidth, innerHeight } = window

  _canvas.width = innerWidth
  _canvas.height = innerHeight
}

function clearCanvas() {
  _canvas.width = _canvas.width
}

window.addEventListener('resize', () => {
  resizeCanvas()
})

resizeCanvas()

// @ts-ignore
const _canvasStream = _canvas.captureStream()

const _canvasCtx = _canvas.getContext('2d')

let _stream: MediaStream

const _playbackUrl = document.getElementById('playback-url')
_playbackUrl.onclick = () => {
  copyToClipboard(_playbackUrl.innerText)
}

const _recordContainer = document.getElementById('record-container')
_recordContainer.style.display = 'block'
_recordContainer.onclick = () => {
  if (_currCast) {
    stopRecording()
  } else {
    if (_stream) {
      startRecording(_stream)
    }
  }
}

const _record = document.getElementById('record')

const _mediaContainer = document.getElementById('media-container')
_mediaContainer.style.display = 'block'
_mediaContainer.onclick = () => {
  if (_mediaDisplay) {
    refreshMediaToUser()
  } else {
    refreshMediaToDisplay()
  }
}

const _media = document.getElementById('media')

let _mediaDisplay = false

let _mediaDisplayReturned = false

let _recordFrashDim = false

let _recordFlashInterval

const MIN_RETRY_THRESHOLD = 60 * 1000 // 1 min

const ALL_TRANSPORTS: Transport[] = ['wrtc', 'ws']

// set background to transparent when inside iframe
if (window.location !== window.parent.location) {
  body.style.background = 'none transparent'
}

const { hostname, pathname, port, protocol } = location

console.log('protocol', protocol)
console.log('hostname', hostname)
console.log('port', port)
console.log('pathname', pathname)

let _videoStream: MediaStream = null
let _currCast: CastSession = null

let _playbackId: string = null
let _streamKey: string | undefined

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

  const portStr = port ? `:${port}` : ''
  _playbackUrl.innerText = `${protocol}//${hostname}${portStr}/${humanId}`
}

function requestedTransport() {
  const match = location.search.match(/transport=([^&]+)/)
  if (!match) {
    return null
  }
  const asTransp = match[1] as Transport
  return ALL_TRANSPORTS.indexOf(asTransp) >= 0 ? asTransp : null
}

function startRecording(stream: MediaStream) {
  if (_currCast || !window.MediaRecorder || !_streamKey) {
    return
  }
  console.log('startRecording')

  const requestedTransp = requestedTransport()

  const isH264 = cast.wsMimeType.indexOf('h264') > 0

  const transport = requestedTransp ?? (isH264 ? 'ws' : 'wrtc')

  const connectTime = Date.now()

  let newCast: CastSession
  if (transport === 'wrtc') {
    newCast = cast.viaWebRTC(stream, _streamKey)
  } else {
    newCast = cast.viaWebSocket(stream, _streamKey, !_playbackId)
  }

  _currCast = newCast

  newCast.onError = (isTransient) => {
    if (_currCast !== newCast) {
      return
    }
    stopRecording()
    _currCast = null

    const connectionAge = Date.now() - connectTime
    const shouldRetry = isTransient && connectionAge >= MIN_RETRY_THRESHOLD
    if (shouldRetry) {
      startRecording(stream)
    }
  }

  _record.style.background = '#dd0000'
  _record.style.borderColor = '#dd0000'

  _video.style.opacity = '1'

  if (_playbackId) {
    _playbackUrl.classList.add('visible')
  }

  _recordFlashInterval = setInterval(() => {
    _recordFrashDim = !_recordFrashDim

    if (_recordFrashDim) {
      _record.style.opacity = '0'
    } else {
      _record.style.opacity = '1'
    }
  }, 1000)
}

function stopRecording() {
  if (!_currCast) {
    return
  }
  console.log('stopRecording')

  _currCast.close()
  _currCast = null

  _record.style.opacity = '1'
  _record.style.background = '#dddddd'
  _record.style.borderColor = '#dddddd'

  _video.style.opacity = '0.5'

  clearInterval(_recordFlashInterval)
}

async function setupMicrophone(): Promise<void> {
  console.log('setupMicrophone')
  const stream = new MediaStream()

  try {
    const microphoneStream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: { echoCancellation: true, noiseSuppression: true },
    })

    const microphoneTracks = microphoneStream.getTracks()

    for (const microphoneTrack of microphoneTracks) {
      stream.addTrack(microphoneTrack)
    }
  } catch (err) {
    console.log('setMicrophoneStream', 'err', err.message)
  }

  const canvasTracks = _canvasStream.getTracks()

  for (const canvasTrack of canvasTracks) {
    stream.addTrack(canvasTrack)
  }

  _stream = stream
}

async function setMediaToDisplay(): Promise<MediaStream> {
  console.log('setMediaToDisplay')

  _mediaDisplay = true
  _mediaDisplayReturned = false

  let stream: MediaStream

  try {
    stream = await navigator.mediaDevices
      // @ts-ignore
      .getDisplayMedia({ audio: true, video: true })
  } catch (err) {
    console.log('navigator', 'getDisplayMedia', 'error', err)
    _mediaDisplay = false
    return
  }

  _mediaDisplayReturned = true

  // AD HOC
  // return to user media if user stopped recording
  const mediaTracks = stream.getTracks()
  const firstMediaTrack = mediaTracks[0]
  if (firstMediaTrack) {
    const end_listener = () => {
      firstMediaTrack.removeEventListener('ended', end_listener)
      refreshMediaToUser()
    }
    firstMediaTrack.addEventListener('ended', end_listener)
  }

  setVideoStream(stream)

  _mediaContainer.style.borderRadius = '30px'
  _media.style.borderRadius = '15px'

  clearCanvas()

  _canvas.style.transform = 'translate(-50%, -50%)'

  return stream
}

function refreshMediaToDisplay(): void {
  setMediaToDisplay()
}

async function setMediaToUser(): Promise<void> {
  console.log('setMediaToUser')

  if (_mediaDisplayReturned) {
    // AD HOC
    // stop browser recording
    _videoStream.getTracks().forEach((track) => track.stop())
  }

  _mediaDisplay = false

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    })

    setVideoStream(stream)

    _media.style.borderRadius = '3px'
    _mediaContainer.style.borderRadius = '6px'

    clearCanvas()

    _canvas.style.transform = 'translate(-50%, -50%) scaleX(-1)'
  } catch (err) {
    console.log('navigator', 'mediaDevices', 'err', err)
  }
}

function refreshMediaToUser(): void {
  setMediaToUser()
}

function setVideoStream(stream: MediaStream): void {
  _videoStream = stream
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

    const { videoWidth = 0, videoHeight = 0 } = _video

    if (videoWidth > 0) {
      let scale: number

      if (videoWidth > videoHeight) {
        scale = innerWidth / videoWidth
        const canvas_height = Math.min(innerHeight, videoHeight * scale)
        _canvas.height = canvas_height
        _canvas.style.height = `${canvas_height}px`
      } else {
        scale = innerHeight / videoHeight
        const canvas_width = Math.min(innerWidth, videoWidth * scale)
        _canvas.width = canvas_width
        _canvas.style.width = `${canvas_width}px`
      }

      _canvasCtx.resetTransform()
      _canvasCtx.scale(scale, scale)

      _canvasCtx.drawImage(_video, 0, 0, videoWidth, videoHeight)
    }

    setupAnimationFrame()
  })
}

setupAnimationFrame()

setupMicrophone()
