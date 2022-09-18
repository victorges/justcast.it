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
  name: string
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

export const playbackUrl = (playbackId: string) =>
  `https://cdn.livepeer.com/hls/${playbackId}/index.m3u8`

export const streamUrl = (streamKey: string) =>
  `rtmp://rtmp.livepeer.com/live/${streamKey}`

export const extractStreamKey = (streamUrl: string) => {
  const matches =
    /rtmp:\/\/rtmp\.livepeer\.com\/live\/(.+)/.exec(streamUrl) ?? []
  return matches.length > 0 ? matches[1] : undefined
}

export class API {
  private readonly http: AxiosInstance

  constructor(apiToken?: string) {
    apiToken ??= process.env.LIVEPEER_API_KEY
    this.http = axios.create({
      baseURL: 'https://livepeer.com/api',
      responseType: 'json',
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    })
  }

  async getStreamById(id: string) {
    const response = await this.http.get<Stream>(`/stream/${id}`)
    return response.data
  }

  async getStreamByName(name: string) {
    const filters = [{ id: 'name', value: name }]
    const response = await this.http.get<Stream[]>(
      `/stream?filters=${JSON.stringify(filters)}&limit=2`
    )
    const streams = response.data
    if (!streams?.length) {
      console.warn(`No streams found with name ${name}`)
      return null
    } else if (streams.length > 1) {
      console.warn(
        `Found multiple streams with name ${name}: ${JSON.stringify(streams)}`
      )
      return null
    }
    return streams[0]
  }

  async createStream(name: string) {
    const response = await this.http.post<Stream>('/stream', { name })
    return response.data
  }
}
