const { body } = document

const iframe = document.getElementById('iframe') as HTMLIFrameElement

// set background to transparent when inside iframe
if (window.location !== window.parent.location) {
  body.style.background = 'none transparent'
}

const { hostname, pathname, port, protocol } = location

console.log('protocol', protocol)
console.log('hostname', hostname)
console.log('port', port)
console.log('pathname', pathname)

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
    iframe.src = `https://lvpr.tv/?v=${info.playbackId}`
  })
