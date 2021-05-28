import WebSocket from 'ws'
import child_process from 'child_process'

import { StreamInfo } from './streamstore'

const logTs = () => new Date().toISOString()

function pipeWsToRtmp(ws: WebSocket, info: StreamInfo) {
  const { streamId, streamUrl } = info
  const log = {
    info: (msg: string) => console.log(`[${logTs()}][stream ${streamId}] ${msg}`),
    err: (msg: string) => console.error(`[${logTs()}][stream ${streamId}] ${msg}`),
  }
  log.info(`Piping ws through ffmpeg to stream: ${JSON.stringify(info)}`)

  const ffmpeg = child_process.spawn('ffmpeg', [
    '-i',
    '-',
    '-vcodec',
    'copy',
    '-acodec',
    'aac',
    '-f',
    'flv',
    streamUrl,
  ])

  ffmpeg.on('close', (code, signal) => {
    log.err(`FFmpeg closed with code ${code} and signal ${signal}`)
    ws.close(1011, `ffmpeg exited with code ${code}`)
  })

  ffmpeg.stdin.on('error', (e) => {
    log.err(`FFmpeg STDIN Error: ${e}`)
  })

  ffmpeg.stderr.on('data', (data) => {
    log.err(`FFmpeg STDERR: ${data.toString()}`)
  })

  ws.on('message', (msg) => {
    ffmpeg.stdin.write(msg)
  })

  ws.on('close', () => {
    ffmpeg.kill('SIGINT')
  })
}

export { pipeWsToRtmp }