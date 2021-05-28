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

let socket = null
let connected = false
let connecting = false

let _stream = null

let recording = false

let _playbackId = null

function send(data) {
  if (!connected) {
    throw new Error('WebSocket is not connected')
  }
  const value = JSON.stringify(data)
  socket.send(value)
}

function connect() {
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

  console.log('socket', 'url', url)

  socket = new WebSocket(url)

  socket.addEventListener('open', function (event) {
    console.log('socket', 'open')

    alert('open')

    connected = true
    connecting = false

    send({
      type: 'init',
      data: {},
    })
  })

  socket.addEventListener('close', function (event) {
    console.log('socket', 'close')

    alert('close')

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

    const { playbackId, humanId, setCookie } = data

    for (const name in setCookie) {
      document.cookie = `${name}=${setCookie[name]}`
    }
    _playbackId = playbackId

    playbackUrl.innerText = `${protocol}//${hostname}${
      localhost ? `:${port}` : ''
    }/${humanId || playbackId}`
  })

  socket.addEventListener('error', (event) => {
    console.log('socket', 'error', event)
  })
}

function disconnect() {
  socket.close()
  socket = null
}

let media_recorder = null

let record_frash_dim = false

function start_recording(stream) {
  // console.log('start_recording', stream)
  // @ts-ignore
  if (window.MediaRecorder) {
    recording = true

    alert('start')

    try {
      // @ts-ignore
      media_recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=h264',
        videoBitsPerSecond: 3 * 1024 * 1024,
      })

      media_recorder.ondataavailable = function (event) {
        const { data } = event
        socket.send(data)
      }

      media_recorder.start(1000)

      record.style.background = '#dd0000'

      video.style.opacity = '1'

      playbackUrl.classList.add('visible')

      if (_playbackId) {
        playbackUrl.classList.add('visible')
      }
    } catch (err) {
      alert(err.message)
    }
    

    alert('A')

    record_flash_interval = setInterval(() => {
      record_frash_dim = !record_frash_dim

      alert('toggle')

      if (record_frash_dim) {
        record.style.opacity = '0'
      } else {
        record.style.opacity = '1'
      }
    }, 1000)
  }
}

let record_flash_interval

function stop_recording() {
  alert('stop')
  recording = false

  media_recorder.stop()

  record.style.opacity = '1'
  record.style.background = '#dddddd'

  video.style.opacity = '0.5'

  clearInterval(record_flash_interval)
}

if (transmitter) {
  video.style.opacity = '0.5'
  video.style.transition = 'opacity 0.2s linear'

  player.volume(0)

  connect()

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
