import WebSocket from 'ws'
import child_process from 'child_process'

import { StreamInfo } from './streamstore'

const logTs = () => new Date().toISOString()

const logger = {
  info: (streamId: string, msg: string) =>
    console.log(`[${logTs()}][stream-${streamId}] ${msg}`),
  err: (streamId: string, msg: string) =>
    console.error(`[${logTs()}][stream-${streamId}] ${msg}`),
}

const baseArgs = ['-i', '-', '-acodec', 'aac', '-f', 'flv']

const videoCopyArgs = [...baseArgs, '-vcodec', 'copy']
const videoTranscodeArgs = [
  ...baseArgs,
  '-vcodec',
  'libx264',
  '-x264-params',
  'keyint=60:scenecut=0',
]
class FFmpeg {
  constructor(
    private info: StreamInfo,
    private mimeType: string,
    private onclose: (code: number | null) => void
  ) {}

  public write(data: any) {
    return this.ffmpeg.stdin.write(data)
  }

  public kill() {
    this.ffmpeg.kill('SIGINT')
    this.ffmpeg.stdin.end()
  }

  private _ffmpeg?: child_process.ChildProcessWithoutNullStreams = undefined

  private get ffmpeg(): child_process.ChildProcessWithoutNullStreams {
    return this._ffmpeg ?? (this._ffmpeg = this.startFfmpeg())
  }

  private startFfmpeg() {
    const baseArgs =
      this.mimeType.indexOf('h264') >= 0 ? videoCopyArgs : videoTranscodeArgs
    const ffmpeg = child_process.spawn('ffmpeg', [
      ...baseArgs,
      this.info.streamUrl,
    ])

    ffmpeg.on('close', (code, signal) => {
      this.logInfo(`FFmpeg closed with code ${code} and signal ${signal}`)
      this.onclose(code)
    })

    ffmpeg.stdin.on('error', (e) => {
      this.logErr(`FFmpeg stdin error: ${e}`)
    })

    ffmpeg.stderr.on('data', (data) => {
      this.logInfo(`FFmpeg stderr: ${data.toString()}`)
    })

    const infoStr = JSON.stringify(this.info)
    this.logInfo(`Piping ws through ffmpeg to stream: ${infoStr}`)
    return ffmpeg
  }

  logErr = (msg: string) => logger.err(this.info.streamId, msg)
  logInfo = (msg: string) => logger.info(this.info.streamId, msg)
}

export function pipeWsToRtmp(
  ws: WebSocket,
  info: StreamInfo,
  mimeType: string
) {
  const ffmpeg = new FFmpeg(info, mimeType, function onclose(code) {
    ws.close(1011, `ffmpeg exited with code ${code}`)
  })
  ws.on('close', (msg) => {
    logger.info(info.streamId, `ws close ${msg}`)
    ffmpeg.kill()
  })

  ws.on('message', (msg) => {
    ffmpeg.write(msg)
  })
}
