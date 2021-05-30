import axios, { AxiosInstance } from 'axios'

export interface TranscodingProfile {
  name: string
  bitrate: number
  fps: number
  height: number
  width: number
}

export interface Stream {
  id: string
  createdAt: number
  createdByTokenName: string
  isActive: boolean
  kind: string
  lastSeen: number
  parentId: string
  playbackId: string
  profiles: TranscodingProfile[]
  record: boolean
  sourceSegments: number
  sourceSegmentsDuration: number
  streamKey: string
  transcodedSegments: number
  transcodedSegmentsDuration: number
  userID: string
}

const defaultProfiles: TranscodingProfile[] = [
  { name: '240p0', fps: 0, bitrate: 250000, width: 426, height: 240 },
  { name: '360p0', fps: 0, bitrate: 800000, width: 640, height: 360 },
  { name: '480p0', fps: 0, bitrate: 1600000, width: 854, height: 480 },
  { name: '720p0', fps: 0, bitrate: 3000000, width: 1280, height: 720 },
]

export const playbackUrl = (playbackId: string) =>
  `https://cdn.livepeer.com/hls/${playbackId}/index.m3u8`

export const streamUrl = (streamKey: string) =>
  `rtmp://rtmp.livepeer.com/live/${streamKey}`

export const extractStreamKey = (streamUrl: string) => {
  const matches = /rtmp:\/\/rtmp\.livepeer\.com\/live\/(.+)/.exec(streamUrl) ?? []
  return matches.length > 0 ? matches[1] : undefined
}

export class API {
  private readonly http: AxiosInstance

  constructor(apiToken?: string) {
    apiToken ??= process.env['LIVEPEER_API_TOKEN']
    this.http = axios.create({
      baseURL: 'https://livepeer.com/api',
      responseType: 'json',
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    })
  }

  async getStream(id: string) {
    const response = await this.http.get<Stream>(`/stream/${id}`)
    return response.data
  }

  async createStream(name: string) {
    const payload = {
      name,
      profiles: defaultProfiles,
    }
    const response = await this.http.post<Stream>('/stream', payload)
    return response.data
  }
}
