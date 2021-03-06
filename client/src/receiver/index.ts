const { body } = document

const video = document.getElementById('video')

// @ts-ignore
const player = videojs(video)

// set background to transparent when inside iframe
if (window.location !== window.parent.location) {
  body.style.background = 'none transparent'
}

const { hostname, pathname, port, protocol } = location

console.log('protocol', protocol)
console.log('hostname', hostname)
console.log('port', port)
console.log('pathname', pathname)

player.volume(1)
player.controls(true)

const humanId = pathname.substr(1)
fetch(`/api/stream/${humanId}`)
  .then((res) => {
    if (res.status === 200) {
      return res.json()
    }
    const playbackUrl = humanId.includes('://')
      ? humanId
      : `https://cdn.livepeer.com/hls/${humanId}/index.m3u8`
    return { playbackUrl }
  })
  .then((info) => {
    player.src({
      src: info.playbackUrl,
      type: 'application/x-mpegURL',
      withCredentials: false,
    })
    player.hlsQualitySelector({
      displayCurrentQuality: true,
    })
  })
