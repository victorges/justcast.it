const log = (...data) => console.log('webrtc', ...data)

async function iceHandshake(
  streamKey: string,
  localDesc: RTCSessionDescription
) {
  const qsKey = streamKey.indexOf('://') > 0 ? 'rtmp' : 'streamKey'
  const answer = await fetch(
    `https://webrtmp.justcast.it/webrtc/offer?${qsKey}=${streamKey}`,
    {
      method: 'POST',
      body: JSON.stringify(localDesc),
      headers: {
        ['content-type']: 'application/json',
      },
    }
  )
  if (answer.status !== 200) {
    throw new Error(`Error response from server: ${answer.status}`)
  }
  const sessionInit = await answer.json()
  return new RTCSessionDescription(sessionInit)
}

function castViaWebRTC(stream: MediaStream, streamKey: string): CastSession {
  const pc = new RTCPeerConnection({
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302',
      },
    ],
  })
  const cast: CastSession = {
    stop: () => pc.close(),
    onConnected: () => {},
    onClosed: () => {},
  }

  stream.getTracks().forEach((track) => pc.addTrack(track, stream))

  pc.oniceconnectionstatechange = () =>
    log('ice connection state', pc.iceConnectionState)
  pc.onicegatheringstatechange = async () => {
    if (pc.iceGatheringState !== 'complete') {
      return
    }
    try {
      const remoteDesc = await iceHandshake(streamKey, pc.localDescription)
      await pc.setRemoteDescription(remoteDesc)
    } catch (err) {
      log(err)
    }
  }
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState
    log('connection state', state)
    switch (state) {
      case 'connected':
        cast.onConnected()
        break
      case 'closed':
        cast.onClosed()
        break
    }
  }

  const initPeerConn = async () => {
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
    } catch (err) {
      log('create offer err', err)
      cast.onClosed(true)
    }
  }
  initPeerConn()

  return cast
}

export default castViaWebRTC
