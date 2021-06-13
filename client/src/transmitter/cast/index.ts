import castViaWebSocket, { mimeType } from './websocket'
import castViaWebRTC from './webrtc'

export default {
  wsMimeType: mimeType,
  viaWebSocket: castViaWebSocket,
  viaWebRTC: castViaWebRTC,
}
