import WebSocket from 'ws'
import child_process from 'child_process'

import { StreamInfo } from './streamstore'

const baseArgs = ['-i', '-', '-acodec', 'aac', '-f', 'flv']

const videoCopyArgs = [...baseArgs, '-vcodec', 'copy']
const videoTranscodeArgs = [
  ...baseArgs,
  '-vcodec',
  'libx264',
  '-x264-params',
  'keyint=60:scenecut=0',
]

const logTs = () => new Date().toISOString()

export function pipeWsToRtmp(ws: WebSocket, info: StreamInfo, mimeType: string) {
  const { streamId, streamUrl } = info
  const log = {
    info: (msg: string) => console.log(`[${logTs()}][stream ${streamId}] ${msg}`),
    err: (msg: string) => console.error(`[${logTs()}][stream ${streamId}] ${msg}`),
  }
  log.info(`Piping ws through ffmpeg to stream: ${JSON.stringify(info)}`)

  let ffProc: child_process.ChildProcessWithoutNullStreams
  const ffmpeg = () => {
    if (ffProc) return ffProc

    const baseArgs = mimeType.indexOf('h264') >= 0 ? videoCopyArgs : videoTranscodeArgs
    ffProc = child_process.spawn('ffmpeg', [
      ...baseArgs,
      streamUrl,
    ])
    ffProc.on('close', (code, signal) => {
      log.err(`FFmpeg closed with code ${code} and signal ${signal}`)
      ws.close(1011, `ffmpeg exited with code ${code}`)
    })

    ffProc.stdin.on('error', (e) => {
      log.err(`FFmpeg STDIN Error: ${e}`)
    })

    ffProc.stderr.on('data', (data) => {
      log.err(`FFmpeg STDERR: ${data.toString()}`)
    })

    ws.on('close', (msg) => {
      log.info('ws close ' + msg)
      ffProc.kill('SIGINT')
      ffProc.stdin.end()
    })
    return ffProc
  }

  ws.on('message', (msg) => {
    ffmpeg().stdin.write(msg)
  })
}
