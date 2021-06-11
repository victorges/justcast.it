const log = (...data) => console.log('webrtc', ...data)

async function iceHandshake(
  streamKey: string,
  localDesc: RTCSessionDescription
) {
  const answer = await fetch(
    `https://webrtmp.justcast.it/webrtc/offer?streamKey=${streamKey}`,
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

async function connetWebRTC(
  stream: MediaStream,
  streamKey: string,
  onConnected?: () => void,
  onClosed?: () => void
) {
  const pc = new RTCPeerConnection({
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302',
      },
    ],
  })

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
        if (onConnected) onConnected()
      case 'closed':
        if (onClosed) onClosed()
    }
  }

  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)

  return pc.close
}

export default connetWebRTC
