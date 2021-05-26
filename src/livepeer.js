const axios = require('axios').default

const apiToken = process.env['LIVEPEER_API_TOKEN']
const http = axios.create({
  baseURL: 'https://livepeer.com/api',
  responseType: 'json',
  headers: {
    Authorization: `Bearer ${apiToken}`,
  },
})

const defaultProfiles = [
  { name: '240p0', fps: 0, bitrate: 250000, width: 426, height: 240 },
  { name: '360p0', fps: 0, bitrate: 800000, width: 640, height: 360 },
  { name: '480p0', fps: 0, bitrate: 1600000, width: 854, height: 480 },
  { name: '720p0', fps: 0, bitrate: 3000000, width: 1280, height: 720 },
]

async function createStream() {
  const ts = new Date().toISOString()
  const name = `justcast-it-${ts}`
  const payload = {
    name,
    profiles: defaultProfiles,
    record: true,
  }
  const response = await http.post('/stream', payload)
  const { id, streamKey, playbackId } = response.data
  return {
    streamId: id,
    streamUrl: `rtmp://rtmp.livepeer.com/live/${streamKey}`,
    playbackId,
    playbackUrl: playbackUrl(playbackId),
  }
}

const playbackUrl = (playbackId) =>
  `https://cdn.livepeer.com/hls/${playbackId}/index.m3u8`

module.exports = {
  createStream,
  playbackUrl,
}
