import isIp from 'is-ip'

const isLocalHost = (hostname) => {
  return hostname === 'localhost' || hostname.endsWith('.localhost')
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

let _mimeType: string | undefined

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
  streamKey: string,
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
  const url = `${protocol}://${hostname}${portStr}/ingest/ws/${streamKey}${query}`

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

const minRetryThreshold = 60 * 1000 // 1 min

function stop_recording() {
  if (!recording) {
    return
  }

  console.log('stop_recording')

  recording = false

  media_recorder.ondataavailable = null
  stop_media_recorder()

  disconnect(1000)
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

const currCast: CastSession = {
  stop: stop_recording,
}

function castToWebSocket(stream: MediaStream, streamKey: string): CastSession {
  if (recording || !window.MediaRecorder || !streamKey) {
    return null
  }

  console.log('start_recording')

  recording = true

  setup_media_recorder(stream)

  const connectTime = Date.now()
  connect(
    streamKey,
    (openEvent) => {
      if (recording) {
        start_media_recorder()
      }
      if (currCast.onConnected) {
        currCast.onConnected()
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
        castToWebSocket(stream, streamKey)
      } else if (currCast.onClosed) {
        currCast.onClosed()
      }
    }
  )
  return currCast
}

export default castToWebSocket
