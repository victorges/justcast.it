import isIp from 'is-ip'

import { copyToClipboard } from '../clipboard'
import castToWebRTC from './webrtc'
import castToWebSocket, { mimeType } from './websocket'

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

let _stream: MediaStream = null
let curr_cast: CastSession = null

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

  const portStr = localhost ? `:${port}` : ''
  playbackUrl.innerText = `${protocol}//${hostname}${portStr}/${humanId}`
}

let record_frash_dim = false

function start_recording(stream: MediaStream) {
  if (curr_cast || !window.MediaRecorder || !_streamKey) {
    return
  }
  console.log('start_recording')

  if (mimeType.indexOf('h264') > 0) {
    curr_cast = castToWebSocket(stream, _streamKey, !_playbackId)
  } else {
    curr_cast = castToWebRTC(stream, _streamKey)
  }
  curr_cast.onClosed = () => {
    if (curr_cast) {
      stop_recording()
    }
    curr_cast = null
  }

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
  if (!curr_cast) {
    return
  }
  console.log('stop_recording')

  curr_cast.stop()
  curr_cast = null

  record.style.opacity = '1'
  record.style.background = '#dddddd'
  record.style.borderColor = '#dddddd'

  video.style.opacity = '0.5'

  clearInterval(record_flash_interval)
}

function refresh_recording(stream: MediaStream): void {
  if (curr_cast) {
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

function set_video_stream(stream: MediaStream): void {
  _stream = stream

  const video = player.tech().el()
  video.srcObject = stream
}

video.style.opacity = '0.5'
video.style.transition = 'opacity 0.2s linear'

player.volume(0)

initStreamData()

set_media_to_user()
// set_media_to_display()

record_container.style.display = 'block'

record_container.onclick = () => {
  if (curr_cast) {
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
