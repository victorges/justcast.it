import path from 'path'
import express from 'express'

const files = express.Router()

const CWD = process.cwd()
const FILE_REGEX = /.+\..+/

const isFilename = (str: string) => {
  return FILE_REGEX.test(str)
}

files.get('*', (req, res) => {
  const { url } = req
  const url_segments = url.split('/')
  const url_segments_length = url_segments.length
  const url_last_segment = url_segments[url_segments_length - 1] || ''
  let file_name
  if (isFilename(url_last_segment)) {
    file_name = url_last_segment
  } else {
    file_name = 'index.html'
  }
  const file_path = path.join(CWD, 'dist/public', file_name)
  res.sendFile(file_path)
})

export { files }
