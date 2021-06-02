import WebSocket from 'ws'
import child_process from 'child_process'

const logTs = () => new Date().toISOString()

const logger = {
  info: (logNs: string, msg: string) =>
    console.log(`[${logTs()}][${logNs}] ${msg}`),
  err: (logNs: string, msg: string) =>
    console.error(`[${logTs()}][${logNs}] ${msg}`),
}

const audioArgs = ['-acodec', 'aac', '-b:a', '128k', '-ar', '44100']
const baseArgs = ['-i', '-', '-f', 'flv', ...audioArgs]

const videoCopyArgs = [...baseArgs, '-vcodec', 'copy']
const videoTranscodeArgs = [
  ...baseArgs,
  '-vcodec',
  'libx264',
  '-x264-params',
  'keyint=60:scenecut=0',
]

export interface Opts {
  logNs: string
  streamUrl: string
  mimeType?: string
}

class FFmpeg {
  private readonly ffmpeg: child_process.ChildProcessWithoutNullStreams

  constructor(
    private opts: Opts,
    private onclose: (code: number | null) => void
  ) {
    this.ffmpeg = this.startFfmpeg()
  }

  public write(data: any) {
    return this.ffmpeg.stdin.write(data)
  }

  public kill() {
    this.ffmpeg.kill('SIGINT')
    this.ffmpeg.stdin.end()
  }

  private startFfmpeg() {
    const mimeType = this.opts.mimeType ?? ''
    const baseArgs =
      mimeType.indexOf('h264') >= 0 ? videoCopyArgs : videoTranscodeArgs
    const ffmpeg = child_process.spawn('ffmpeg', [
      ...baseArgs,
      this.opts.streamUrl,
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

    const optsStr = JSON.stringify(this.opts)
    this.logInfo(`Piping ws through ffmpeg to stream: ${optsStr}`)
    return ffmpeg
  }

  logErr = (msg: string) => logger.err(this.opts.logNs, msg)
  logInfo = (msg: string) => logger.info(this.opts.logNs, msg)
}

export function pipeWsToRtmp(ws: WebSocket, opts: Opts) {
  const ffmpeg = new FFmpeg(opts, function onclose(code) {
    ws.close(1011, `ffmpeg exited with code ${code}`)
  })
  ws.on('close', (msg) => {
    logger.info(opts.logNs, `ws close ${msg}`)
    ffmpeg.kill()
  })

  ws.on('message', (msg) => {
    ffmpeg.write(msg)
  })
}
