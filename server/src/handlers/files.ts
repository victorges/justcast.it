import path from 'path'
import express from 'express'

const files = express.Router()

const CWD = process.cwd()
const FILE_REGEX = /.+\..+/

const isFilename = (str: string) => {
  return FILE_REGEX.test(str)
}

files.get('*', (req, res, next) => {
  res.set('Feature-Policy', 'camera *; microphone *;')
  next()
})

files.get('*', (req, res) => {
  const path_segs = req.path.substr(1)

  const path_first_segment = path_segs.split('/', 1)[0]
  const path_other_segments = path_segs.substr(path_first_segment.length + 1)

  let subfolder: string
  if (['', 'transmitter', 'to'].includes(path_first_segment)) {
    subfolder = 'transmitter'
  } else {
    subfolder = 'receiver'
  }

  let file_name: string
  if (isFilename(path_other_segments)) {
    file_name = path_other_segments
  } else {
    file_name = 'index.html'
  }

  const file_path = path.join(CWD, 'dist/public', subfolder, file_name)

  res.sendFile(file_path)
})

export { files }
