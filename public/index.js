const isLocalHost = (hostname) => {
  return hostname === 'localhost' || hostname.endsWith('.localhost')
}

// https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript

function copyToClipboard(text) {
  if (window.clipboardData && window.clipboardData.setData) {
    // Internet Explorer-specific code path to prevent textarea being shown while dialog is visible.
    return window.clipboardData.setData('Text', text)
  } else if (
    document.queryCommandSupported &&
    document.queryCommandSupported('copy')
  ) {
    var textarea = document.createElement('textarea')
    textarea.textContent = text
    textarea.style.position = 'fixed' // Prevent scrolling to bottom of page in Microsoft Edge.
    document.body.appendChild(textarea)
    textarea.select()
    try {
      return document.execCommand('copy') // Security exception may be thrown by some browsers.
    } catch (ex) {
      console.warn('Copy to clipboard failed.', ex)
      return false
    } finally {
      document.body.removeChild(textarea)
    }
  }
}

// https://github.com/sindresorhus/ip-regex/blob/main/index.js

const word = '[a-fA-F\\d:]'
const b = (options) =>
  options && options.includeBoundaries
    ? `(?:(?<=\\s|^)(?=${word})|(?<=${word})(?=\\s|$))`
    : ''

const v4 =
  '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}'

const v6seg = '[a-fA-F\\d]{1,4}'
const v6 = `
	(?:
	(?:${v6seg}:){7}(?:${v6seg}|:)|                                    // 1:2:3:4:5:6:7::  1:2:3:4:5:6:7:8
	(?:${v6seg}:){6}(?:${v4}|:${v6seg}|:)|                             // 1:2:3:4:5:6::    1:2:3:4:5:6::8   1:2:3:4:5:6::8  1:2:3:4:5:6::1.2.3.4
	(?:${v6seg}:){5}(?::${v4}|(?::${v6seg}){1,2}|:)|                   // 1:2:3:4:5::      1:2:3:4:5::7:8   1:2:3:4:5::8    1:2:3:4:5::7:1.2.3.4
	(?:${v6seg}:){4}(?:(?::${v6seg}){0,1}:${v4}|(?::${v6seg}){1,3}|:)| // 1:2:3:4::        1:2:3:4::6:7:8   1:2:3:4::8      1:2:3:4::6:7:1.2.3.4
	(?:${v6seg}:){3}(?:(?::${v6seg}){0,2}:${v4}|(?::${v6seg}){1,4}|:)| // 1:2:3::          1:2:3::5:6:7:8   1:2:3::8        1:2:3::5:6:7:1.2.3.4
	(?:${v6seg}:){2}(?:(?::${v6seg}){0,3}:${v4}|(?::${v6seg}){1,5}|:)| // 1:2::            1:2::4:5:6:7:8   1:2::8          1:2::4:5:6:7:1.2.3.4
	(?:${v6seg}:){1}(?:(?::${v6seg}){0,4}:${v4}|(?::${v6seg}){1,6}|:)| // 1::              1::3:4:5:6:7:8   1::8            1::3:4:5:6:7:1.2.3.4
	(?::(?:(?::${v6seg}){0,5}:${v4}|(?::${v6seg}){1,7}|:))             // ::2:3:4:5:6:7:8  ::2:3:4:5:6:7:8  ::8             ::1.2.3.4
	)(?:%[0-9a-zA-Z]{1,})?                                             // %eth0            %1
	`
  .replace(/\s*\/\/.*$/gm, '')
  .replace(/\n/g, '')
  .trim()

const v46Exact = new RegExp(`(?:^${v4}$)|(?:^${v6}$)`)
const v4exact = new RegExp(`^${v4}$`)
const v6exact = new RegExp(`^${v6}$`)

const ip = (options) =>
  options && options.exact
    ? v46Exact
    : new RegExp(
        `(?:${b(options)}${v4}${b(options)})|(?:${b(options)}${v6}${b(
          options
        )})`,
        'g'
      )

ip.v4 = (options) =>
  options && options.exact
    ? v4exact
    : new RegExp(`${b(options)}${v4}${b(options)}`, 'g')
ip.v6 = (options) =>
  options && options.exact
    ? v6exact
    : new RegExp(`${b(options)}${v6}${b(options)}`, 'g')

// https://github.com/sindresorhus/is-ip/blob/main/index.js

const isIp = (str) => ip({ exact: true }).test(str)
isIp.v4 = (str) => ip.v4({ exact: true }).test(str)
isIp.v6 = (str) => ip.v6({ exact: true }).test(str)
isIp.version = (str) => (isIp(str) ? (isIp.v4(str) ? 4 : 6) : undefined)

const video = document.getElementById('video')
const playbackUrl = document.getElementById('playbackUrl')

const record_container = document.getElementById('record-container')
const record = document.getElementById('record')

playbackUrl.onclick = () => {
  copyToClipboard(playbackUrl.innerText)
}

const player = videojs(video)

if (window.location !== window.parent.location) {
  canvas.style.background = 'none transparent'
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

    connected = true
    connecting = false

    send({
      type: 'init',
      data: {},
    })
  })

  socket.addEventListener('close', function (event) {
    console.log('socket', 'close', event)

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
    if (recording) {
      playbackUrl.classList.add('visible')
    }
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
  recording = true

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
  video.style.opacity = 1
  if (_playbackId) {
    playbackUrl.classList.add('visible')
  }

  record_flash_interval = setInterval(() => {
    record_frash_dim = !record_frash_dim

    if (record_frash_dim) {
      record.style.opacity = 0
    } else {
      record.style.opacity = 1
    }
  }, 1000)
}

function stop_recording() {
  recording = false

  media_recorder.stop()

  record.style.opacity = 1
  record.style.background = '#dddddd'
  video.style.opacity = 0.5

  clearInterval(record_flash_interval)
}

if (transmitter) {
  video.style.opacity = 0.5
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
