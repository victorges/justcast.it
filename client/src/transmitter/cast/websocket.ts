import isIp from 'is-ip'

const isLocalHost = (hostname) => {
  return hostname === 'localhost' || hostname.endsWith('.localhost')
}

const { hostname, port, protocol } = location

const isLocalOrIp = isLocalHost(hostname) || isIp(hostname)

const secure = protocol === 'https:'

function getMimeType() {
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

  let mimeType = ''
  for (const type of types) {
    const supported = MediaRecorder.isTypeSupported(type)
    if (supported) {
      mimeType = type
      break
    }
  }

  console.log('_mimeType', mimeType)
  return mimeType
}

export const mimeType = getMimeType()

function querystring(params: Record<string, any>) {
  const escape = encodeURIComponent
  const raw = Object.keys(params)
    .filter((k) => !!params[k])
    .map((k) => escape(k) + '=' + escape(params[k].toString()))
    .join('&')
  return raw.length === 0 ? '' : '?' + raw
}

function connect(streamKey: string, ignoreCookies: boolean) {
  const protocol = !isLocalOrIp && secure ? 'wss' : 'ws'
  const portStr = isLocalOrIp ? `:${port}` : ''
  const query = querystring({ mimeType, ignoreCookies })
  const url = `${protocol}://${hostname}${portStr}/ingest/ws/${streamKey}${query}`

  console.log('socket', 'url', url)

  const socket = new WebSocket(url)

  socket.addEventListener('message', (event) => {
    const { data: message } = event
    const data = JSON.parse(message)

    console.log('socket', 'message', data)
  })

  socket.addEventListener('error', (event) => {
    console.log('socket', 'error', event)
  })

  return socket
}

function stop_recording(media_recorder: MediaRecorder, socket: WebSocket) {
  console.log('stop_recording')

  media_recorder.ondataavailable = null
  stop_media_recorder(media_recorder)

  socket.close(1000)
}

function new_media_recorder(stream: MediaStream): MediaRecorder {
  const recorder = new MediaRecorder(stream, {
    mimeType: mimeType,
    audioBitsPerSecond: 128 * 1000,
    videoBitsPerSecond: 3 * 1024 * 1024,
  })
  return recorder
}

const MEDIA_RECORDER_T = 2000

function start_media_recorder(media_recorder: MediaRecorder): void {
  if (media_recorder.state === 'recording') {
    return
  }
  console.log('start_media_recorder')
  media_recorder.start(MEDIA_RECORDER_T)
}

function stop_media_recorder(media_recorder: MediaRecorder): void {
  if (media_recorder.state === 'inactive') {
    return
  }
  console.log('stop_media_recorder')
  media_recorder.stop()
}

function castViaWebSocket(
  stream: MediaStream,
  streamKey: string,
  ignoreCookies: boolean
): CastSession {
  if (!window.MediaRecorder || !streamKey) {
    return null
  }
  console.log('castToWebSocket')

  const socket = connect(streamKey, ignoreCookies)
  const recorder = new_media_recorder(stream)

  const cast: CastSession = {
    stop: () => stop_recording(recorder, socket),
    onConnected: () => {},
    onClosed: () => {},
  }

  let connected = false
  recorder.ondataavailable = function (event) {
    const { data } = event
    if (connected) {
      socket.send(data)
    }
  }

  socket.addEventListener('open', () => {
    console.log('socket', 'open')
    connected = true

    start_media_recorder(recorder)
    cast.onConnected()
  })
  socket.addEventListener('close', ({ code, reason }) => {
    console.log('socket', 'close', code, reason)
    connected = false

    stop_recording(recorder, socket)
    cast.onClosed(code === 1006)
  })

  return cast
}

export default castViaWebSocket
