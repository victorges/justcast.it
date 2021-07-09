import express from 'express'
import fs from 'fs'
import path from 'path'
import util from 'util'

const files = express.Router()

const CWD = process.cwd()
const FILE_REGEX = /^[^:]+\.[^/]+$/

const SUBFOLDERS = {
  transmitter: path.join(CWD, 'dist/public/transmitter'),
  receiver: path.join(CWD, 'dist/public/receiver'),
}

const isFilename = (str: string) => {
  return FILE_REGEX.test(str)
}

const fsExistsAsync = util.promisify(fs.exists)

const fileExists = async (...paths: string[]) => {
  if (!isFilename(paths[paths.length - 1])) {
    return false
  }
  return fsExistsAsync(path.join(...paths))
}

files.get('*', (req, res, next) => {
  res.set('Feature-Policy', 'camera *; microphone *;')
  next()
})

files.get('*', async (req, res) => {
  const path_segs = req.path.substr(1)

  const path_first_segment = path_segs.split('/', 1)[0]
  const path_other_segments = path_segs.substr(path_first_segment.length + 1)

  let subfolder: string
  if (['', 'transmitter', 'to'].includes(path_first_segment)) {
    subfolder = SUBFOLDERS.transmitter
  } else {
    subfolder = SUBFOLDERS.receiver
  }

  let file_name: string
  if (await fileExists(subfolder, path_other_segments)) {
    file_name = path_other_segments
  } else {
    file_name = 'index.html'
  }

  const file_path = path.join(subfolder, file_name)

  res.sendFile(file_path)
})

export { files }
