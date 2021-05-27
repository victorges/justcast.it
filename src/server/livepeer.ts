import axios from 'axios'

const apiToken = process.env['LIVEPEER_API_TOKEN']
const http = axios.create({
  baseURL: 'https://livepeer.com/api',
  responseType: 'json',
  headers: {
    Authorization: `Bearer ${apiToken}`,
  },
})

const playbackUrl = (playbackId) =>
  `https://cdn.livepeer.com/hls/${playbackId}/index.m3u8`

const streamObjToInfo = ({ id, streamKey, playbackId }) => ({
  streamId: id,
  streamUrl: `rtmp://rtmp.livepeer.com/live/${streamKey}`,
  playbackId,
  playbackUrl: playbackUrl(playbackId),
})

async function getStream(id) {
  const response = await http.get(`/stream/${id}`)
  return streamObjToInfo(response.data)
}

const defaultProfiles = [
  { name: '240p0', fps: 0, bitrate: 250000, width: 426, height: 240 },
  { name: '360p0', fps: 0, bitrate: 800000, width: 640, height: 360 },
  { name: '480p0', fps: 0, bitrate: 1600000, width: 854, height: 480 },
  { name: '720p0', fps: 0, bitrate: 3000000, width: 1280, height: 720 },
]

async function createStream(name) {
  const payload = {
    name,
    profiles: defaultProfiles,
  }
  const response = await http.post('/stream', payload)
  const info = streamObjToInfo(response.data)
  return info
}

export default {
  playbackUrl,
  getStream,
  createStream,
}
