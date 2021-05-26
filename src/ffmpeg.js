const child_process = require('child_process')

const logTs = () => new Date().toISOString()

function pipeWsToRtmp(ws, info) {
  const { streamId, streamUrl } = info
  const log = {
    info: (msg) => console.log(`[${logTs()}][stream ${streamId}] ${msg}`),
    err: (msg) => console.error(`[${logTs()}][stream ${streamId}] ${msg}`),
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

module.exports = { pipeWsToRtmp }