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
  return (await answer.json()) as RTCSessionDescriptionInit
}

function castToWebRTC(stream: MediaStream, streamKey: string): CastSession {
  const pc = new RTCPeerConnection({
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302',
      },
    ],
  })
  const cast: CastSession = { stop: () => pc.close() }

  stream.getTracks().forEach((track) => pc.addTrack(track, stream))

  pc.oniceconnectionstatechange = () =>
    log('ice connection state', pc.iceConnectionState)
  pc.onicegatheringstatechange = () => {
    if (pc.iceGatheringState !== 'complete') {
      return
    }
    iceHandshake(streamKey, pc.localDescription)
      .then(async (remoteDesc) => {
        await pc.setRemoteDescription(new RTCSessionDescription(remoteDesc))
      })
      .catch(log)
  }
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState
    log('connection state', state)
    switch (state) {
      case 'connected':
        cast.onConnected?.call(cast)
        break
      case 'closed':
        cast.onClosed?.call(cast)
        break
    }
  }

  pc.createOffer()
    .then((offer) => pc.setLocalDescription(offer))
    .catch((err) => {
      log('create offer err', err)
      cast.onClosed?.call(cast)
    })

  return cast
}

export default castToWebRTC
